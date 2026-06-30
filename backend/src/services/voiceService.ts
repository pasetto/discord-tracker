import { VoiceState } from 'discord.js';
import { Types } from 'mongoose';
import { createLogger } from '../logger';
import { userRepository } from '../repositories/userRepository';
import { voiceSessionRepository } from '../repositories/voiceSessionRepository';
import { voiceChannelTransitionRepository } from '../repositories/voiceChannelTransitionRepository';
import { systemLogRepository } from '../repositories/systemLogRepository';
import { classifyVoiceChannel } from './channelClassifier';
import { VoiceEventType } from '../config/env';
import { setActiveSessions } from '../metrics/prometheus';
import { presenceSessionRepository } from '../repositories/presenceSessionRepository';
import { channelRuleRepository } from '../repositories/channelRuleRepository';
import { isMonitoredGuild, resolveMonitoredGuild } from './guildMonitoringService';
import {
  liveActivityBroadcaster,
  publishLiveGuildSnapshot,
  type LiveVoiceTransitionEvent,
} from './liveActivityBroadcaster';
import { upsertTrackedUser } from './trackedUserService';
import { createKeyedMutex } from '../utils/keyedMutex';

const log = createLogger('voice');

/**
 * Serializa o processamento de eventos de voz por usuário/guild, evitando que
 * múltiplas trocas de canal quase simultâneas criem sessões abertas duplicadas.
 */
const voiceEventMutex = createKeyedMutex();

/**
 * Determina o tipo de evento de voz com base na transição de estados.
 * @param oldState Estado anterior
 * @param newState Novo estado
 * @returns Tipo do evento ou null se irrelevante
 */
export function detectVoiceEvent(oldState: VoiceState, newState: VoiceState): VoiceEventType | null {
  const hadChannel = oldState.channelId !== null;
  const hasChannel = newState.channelId !== null;

  if (!hadChannel && hasChannel) {
    return 'JOIN';
  }
  if (hadChannel && !hasChannel) {
    return 'DISCONNECT';
  }
  if (hadChannel && hasChannel && oldState.channelId !== newState.channelId) {
    if (newState.serverDeaf || newState.serverMute) {
      return 'MOVED';
    }
    const newName = newState.channel?.name?.toLowerCase() ?? '';
    if (newName.includes('afk')) {
      return 'AFK_AUTO';
    }
    return 'SWITCH';
  }
  if (!hadChannel && !hasChannel && oldState.sessionId && newState.sessionId) {
    return 'RECONNECT';
  }
  if (hadChannel && !hasChannel) {
    return 'LEAVE';
  }

  return null;
}

/**
 * Serviço de monitoramento de sessões de voz.
 */
export const voiceService = {
  /**
   * Garante usuário no banco a partir do VoiceState.
   * @param state Estado de voz Discord
   * @returns ObjectId Mongo
   */
  async ensureUser(state: VoiceState): Promise<Types.ObjectId> {
    const member = state.member;
    if (!member) {
      throw new Error('VoiceState sem membro associado');
    }

    const doc = await userRepository.upsert({
      discordId: member.id,
      username: member.user.username,
      displayName: member.displayName ?? member.user.username,
    });

    return doc._id as Types.ObjectId;
  },

  /**
   * Abre sessão de voz para o canal informado.
   *
   * Garante que nenhuma sessão de voz anterior do mesmo usuário fique aberta:
   * fecha todas as abertas antes de criar a nova (uma pessoa só pode estar em um
   * canal por vez). Protege também chamadas fora do fluxo normal (ex.: recovery).
   * @param userId ObjectId Mongo
   * @param channelId ID do canal
   * @param channelName Nome do canal
   * @param startedAt Início da sessão
   * @param organizationId ID da organização dona do monitoramento
   * @param guildId ID do servidor Discord de origem
   */
  async startVoiceSession(
    userId: Types.ObjectId,
    channelId: string,
    channelName: string,
    startedAt: Date,
    organizationId: string,
    guildId: string,
  ): Promise<void> {
    const rules = await channelRuleRepository.getByGuildId(guildId);
    const classification = classifyVoiceChannel(channelId, channelName, rules);

    await voiceSessionRepository.closeAllOpenByUserId(
      userId,
      new Types.ObjectId(organizationId),
      guildId,
      startedAt,
    );

    await voiceSessionRepository.create({
      organizationId: new Types.ObjectId(organizationId),
      guildId,
      userId,
      channelId,
      channelName,
      startedAt,
      isIgnoredChannel: classification.isIgnored,
      sessionType: classification.sessionType,
    });

    await this.refreshMetrics();
  },

  /**
   * Encerra sessão de voz aberta do usuário.
   * @param userId ObjectId Mongo
   * @param endedAt Momento de encerramento
   * @param organizationId ID da organização dona do monitoramento
   * @param guildId ID do servidor Discord de origem
   */
  async endOpenSession(userId: Types.ObjectId, endedAt: Date, organizationId: string, guildId: string): Promise<void> {
    const closed = await voiceSessionRepository.closeAllOpenByUserId(
      userId,
      new Types.ObjectId(organizationId),
      guildId,
      endedAt,
    );
    if (closed > 0) {
      await this.refreshMetrics();
    }
  },

  /**
   * Processa evento voiceStateUpdate completo.
   *
   * Serializa o processamento por usuário/guild para que o fluxo de fechar a
   * sessão anterior e abrir a nova nunca se intercale com outro evento do mesmo
   * usuário (causa raiz de sessões abertas duplicadas em trocas rápidas).
   * @param oldState Estado anterior
   * @param newState Novo estado
   */
  async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const guildId = newState.guild?.id ?? oldState.guild?.id;
    const discordUserId = newState.id ?? oldState.id;
    const mutexKey = `${guildId ?? 'unknown'}:${discordUserId ?? 'unknown'}`;

    await voiceEventMutex.runExclusive(mutexKey, () =>
      this.processVoiceStateUpdate(oldState, newState),
    );
  },

  /**
   * Lógica de processamento de um evento de voz (executada sob exclusão mútua).
   * @param oldState Estado anterior
   * @param newState Novo estado
   */
  async processVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const guildId = newState.guild?.id ?? oldState.guild?.id;
    if (!(await isMonitoredGuild(guildId))) {
      return;
    }

    const monitored = await resolveMonitoredGuild(guildId);
    if (!monitored) {
      return;
    }

    if (newState.member?.user.bot) {
      return;
    }

    const eventType = detectVoiceEvent(oldState, newState);
    if (!eventType) {
      return;
    }

    const voiceState = newState.member ? newState : oldState;
    const userId = await this.ensureUser(voiceState);
    const now = new Date();
    const displayName =
      voiceState.member?.displayName ?? voiceState.member?.user.username ?? voiceState.id;

    await upsertTrackedUser({
      organizationId: monitored.organizationId,
      guildId: monitored.guildId,
      discordId: voiceState.id,
      username: voiceState.member?.user.username ?? voiceState.id,
      displayName,
      seenAt: now,
    });

    const fromChannel = oldState.channel;
    const toChannel = newState.channel;
    const rules = await channelRuleRepository.getByGuildId(monitored.guildId);
    const fromClassification = fromChannel
      ? classifyVoiceChannel(fromChannel.id, fromChannel.name, rules)
      : null;
    const toClassification = toChannel
      ? classifyVoiceChannel(toChannel.id, toChannel.name, rules)
      : null;
    const countsAsCollaboration =
      toClassification !== null && !toClassification.isIgnored && toClassification.sessionType === 'VOICE';

    const transitionPayload = {
      organizationId: monitored.organizationId,
      guildId: monitored.guildId,
      userId,
      discordId: voiceState.id,
      displayName,
      eventType,
      fromChannelId: fromChannel?.id,
      fromChannelName: fromChannel?.name,
      toChannelId: toChannel?.id,
      toChannelName: toChannel?.name,
      fromSessionType: fromClassification?.sessionType,
      toSessionType: toClassification?.sessionType,
      fromIgnored: fromClassification?.isIgnored ?? false,
      toIgnored: toClassification?.isIgnored ?? false,
      countsAsCollaboration,
      occurredAt: now,
    };

    const isDuplicateTransition = await voiceChannelTransitionRepository.hasRecentDuplicate(transitionPayload);
    if (!isDuplicateTransition) {
      await voiceChannelTransitionRepository.create(transitionPayload);

      const transitionEvent: LiveVoiceTransitionEvent = {
        organizationId: monitored.organizationId,
        guildId: monitored.guildId,
        discordId: voiceState.id,
        displayName,
        eventType,
        fromChannelName: fromChannel?.name,
        toChannelName: toChannel?.name,
        fromIgnored: fromClassification?.isIgnored ?? false,
        toIgnored: toClassification?.isIgnored ?? false,
        countsAsCollaboration,
        occurredAt: now.toISOString(),
      };
      liveActivityBroadcaster.publishTransition(
        monitored.organizationId,
        monitored.guildId,
        transitionEvent,
      );
    }

    switch (eventType) {
      case 'JOIN':
      case 'RECONNECT':
        await this.endOpenSession(userId, now, monitored.organizationId, monitored.guildId);
        if (toChannel) {
          await this.startVoiceSession(userId, toChannel.id, toChannel.name, now, monitored.organizationId, monitored.guildId);
        }
        log.info(
          {
            discordId: newState.id,
            username: newState.member?.user.username,
            channelId: toChannel?.id,
            channelName: toChannel?.name,
            eventType,
          },
          'Entrada em canal de voz',
        );
        break;

      case 'LEAVE':
      case 'DISCONNECT':
        await this.endOpenSession(userId, now, monitored.organizationId, monitored.guildId);
        log.info(
          {
            discordId: oldState.id,
            username: oldState.member?.user.username,
            channelId: fromChannel?.id,
            channelName: fromChannel?.name,
            eventType,
          },
          'Saída de canal de voz',
        );
        break;

      case 'SWITCH':
      case 'MOVED':
      case 'AFK_AUTO':
        await this.endOpenSession(userId, now, monitored.organizationId, monitored.guildId);
        if (toChannel) {
          await this.startVoiceSession(userId, toChannel.id, toChannel.name, now, monitored.organizationId, monitored.guildId);
        }
        log.info(
          {
            discordId: newState.id,
            username: newState.member?.user.username,
            fromChannelId: fromChannel?.id,
            fromChannelName: fromChannel?.name,
            toChannelId: toChannel?.id,
            toChannelName: toChannel?.name,
            eventType,
          },
          'Troca de canal de voz',
        );
        break;
    }

    await systemLogRepository.create('info', `Evento de voz: ${eventType}`, 'voice', {
      discordId: newState.id,
      fromChannelId: fromChannel?.id,
      fromChannelName: fromChannel?.name,
      toChannelId: toChannel?.id,
      toChannelName: toChannel?.name,
      eventType,
    });

    await this.refreshMetrics();
    void publishLiveGuildSnapshot(monitored.organizationId, monitored.guildId);
  },

  /**
   * Atualiza métricas Prometheus de sessões ativas.
   */
  async refreshMetrics(): Promise<void> {
    const [voice, presence] = await Promise.all([
      voiceSessionRepository.countOpen(),
      presenceSessionRepository.countOpen(),
    ]);
    setActiveSessions(voice, presence);
  },
};
