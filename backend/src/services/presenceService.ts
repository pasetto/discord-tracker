import { Presence } from 'discord.js';
import { Types } from 'mongoose';
import { createLogger } from '../logger';
import { userRepository } from '../repositories/userRepository';
import { presenceSessionRepository } from '../repositories/presenceSessionRepository';
import { systemLogRepository } from '../repositories/systemLogRepository';
import { mapDiscordPresenceStatus } from './channelClassifier';
import { PresenceStatus } from '../config/env';
import { setActiveSessions } from '../metrics/prometheus';
import { voiceSessionRepository } from '../repositories/voiceSessionRepository';
import { isMonitoredGuild, resolveMonitoredGuild } from './guildMonitoringService';
import { publishLiveGuildSnapshot } from './liveActivityBroadcaster';
import { upsertTrackedUser } from './trackedUserService';

const log = createLogger('presence');

/**
 * Serviço de monitoramento e persistência de sessões de presença.
 */
export const presenceService = {
  /**
   * Garante que o usuário existe no banco e retorna seu ObjectId.
   * @param presence Objeto Presence do Discord
   * @returns ObjectId Mongo do usuário
   */
  async ensureUser(presence: Presence): Promise<Types.ObjectId> {
    const user = presence.user;
    if (!user) {
      throw new Error('Presence sem usuário associado');
    }

    const member = presence.member;
    const doc = await userRepository.upsert({
      discordId: user.id,
      username: user.username,
      displayName: member?.displayName ?? user.globalName ?? user.username,
    });

    return doc._id as Types.ObjectId;
  },

  /**
   * Inicia uma nova sessão de presença para o usuário.
   * @param userId ObjectId Mongo
   * @param status Status inicial
   * @param startedAt Timestamp de início
   * @param organizationId ID da organização dona do monitoramento
   * @param guildId ID do servidor Discord de origem
   */
  async startSession(
    userId: Types.ObjectId,
    status: PresenceStatus,
    startedAt: Date,
    organizationId: string,
    guildId: string,
  ): Promise<void> {
    await presenceSessionRepository.create({
      organizationId: new Types.ObjectId(organizationId),
      guildId,
      userId,
      status,
      startedAt,
    });
    await this.refreshMetrics();
  },

  /**
   * Encerra a sessão de presença aberta do usuário.
   * @param userId ObjectId Mongo
   * @param endedAt Timestamp de fim
   * @param organizationId ID da organização dona do monitoramento
   * @param guildId ID do servidor Discord de origem
   */
  async endOpenSession(userId: Types.ObjectId, endedAt: Date, organizationId: string, guildId: string): Promise<void> {
    const closed = await presenceSessionRepository.closeAllOpenByUserId(
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
   * Processa mudança de presença (presenceUpdate).
   * @param _oldPresence Presença anterior (pode ser parcial)
   * @param newPresence Nova presença
   */
  async handlePresenceUpdate(_oldPresence: Presence | null, newPresence: Presence): Promise<void> {
    if (!(await isMonitoredGuild(newPresence.guild?.id))) {
      return;
    }

    const monitored = await resolveMonitoredGuild(newPresence.guild?.id);
    if (!monitored) {
      return;
    }

    if (!newPresence.user || newPresence.user.bot) {
      return;
    }

    const userId = await this.ensureUser(newPresence);
    const newStatus = mapDiscordPresenceStatus(newPresence.status);
    const now = new Date();

    const openSession = await presenceSessionRepository.findOpenByUserId(
      userId,
      new Types.ObjectId(monitored.organizationId),
      monitored.guildId,
    );
    const currentStatus = openSession?.status;

    if (currentStatus === newStatus) {
      return;
    }

    // Fecha todas as sessões abertas (não só a mais recente) para sanar órfãs
    // acumuladas por corridas de eventos antes de abrir a nova.
    await presenceSessionRepository.closeAllOpenByUserId(
      userId,
      new Types.ObjectId(monitored.organizationId),
      monitored.guildId,
      now,
    );

    await presenceSessionRepository.create({
      organizationId: new Types.ObjectId(monitored.organizationId),
      guildId: monitored.guildId,
      userId,
      status: newStatus,
      startedAt: now,
    });

    log.info(
      {
        discordId: newPresence.user.id,
        username: newPresence.user.username,
        previousStatus: currentStatus ?? 'UNKNOWN',
        newStatus,
      },
      'Mudança de presença registrada',
    );

    await systemLogRepository.create('info', 'Mudança de presença', 'presence', {
      discordId: newPresence.user.id,
      previousStatus: currentStatus,
      newStatus,
    });

    await upsertTrackedUser({
      organizationId: monitored.organizationId,
      guildId: monitored.guildId,
      discordId: newPresence.user.id,
      username: newPresence.user.username,
      displayName: newPresence.member?.displayName ?? newPresence.user.globalName ?? newPresence.user.username,
      seenAt: now,
    });

    await this.refreshMetrics();
    void publishLiveGuildSnapshot(monitored.organizationId, monitored.guildId);
  },

  /**
   * Atualiza métricas de sessões ativas no Prometheus.
   */
  async refreshMetrics(): Promise<void> {
    const [voice, presence] = await Promise.all([
      voiceSessionRepository.countOpen(),
      presenceSessionRepository.countOpen(),
    ]);
    setActiveSessions(voice, presence);
  },
};
