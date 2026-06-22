import { VoiceState } from 'discord.js';
import { Types } from 'mongoose';
import { createLogger } from '../logger';
import { userRepository } from '../repositories/userRepository';
import { voiceSessionRepository } from '../repositories/voiceSessionRepository';
import { systemLogRepository } from '../repositories/systemLogRepository';
import { classifyChannel } from './channelClassifier';
import { VoiceEventType } from '../config/env';
import { setActiveSessions } from '../metrics/prometheus';
import { presenceSessionRepository } from '../repositories/presenceSessionRepository';
import { guildService } from './guildService';

const log = createLogger('voice');

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
   * @param userId ObjectId Mongo
   * @param channelId ID do canal
   * @param channelName Nome do canal
   * @param startedAt Início da sessão
   */
  async startVoiceSession(
    userId: Types.ObjectId,
    channelId: string,
    channelName: string,
    startedAt: Date,
  ): Promise<void> {
    const classification = classifyChannel(channelId, channelName);

    await voiceSessionRepository.create({
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
   */
  async endOpenSession(userId: Types.ObjectId, endedAt: Date): Promise<void> {
    const open = await voiceSessionRepository.findOpenByUserId(userId);
    if (open) {
      await voiceSessionRepository.close(open._id, endedAt);
      await this.refreshMetrics();
    }
  },

  /**
   * Processa evento voiceStateUpdate completo.
   * @param oldState Estado anterior
   * @param newState Novo estado
   */
  async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const guildId = newState.guild?.id ?? oldState.guild?.id;
    if (!guildService.isMonitoredGuild(guildId)) {
      return;
    }

    if (newState.member?.user.bot) {
      return;
    }

    const eventType = detectVoiceEvent(oldState, newState);
    if (!eventType) {
      return;
    }

    const userId = await this.ensureUser(newState.member ? newState : oldState);
    const now = new Date();

    const fromChannel = oldState.channel;
    const toChannel = newState.channel;

    switch (eventType) {
      case 'JOIN':
      case 'RECONNECT':
        await this.endOpenSession(userId, now);
        if (toChannel) {
          await this.startVoiceSession(userId, toChannel.id, toChannel.name, now);
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
        await this.endOpenSession(userId, now);
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
        await this.endOpenSession(userId, now);
        if (toChannel) {
          await this.startVoiceSession(userId, toChannel.id, toChannel.name, now);
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
