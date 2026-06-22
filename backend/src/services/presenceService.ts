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
import { guildService } from './guildService';

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
   */
  async startSession(userId: Types.ObjectId, status: PresenceStatus, startedAt: Date): Promise<void> {
    await presenceSessionRepository.create({ userId, status, startedAt });
    await this.refreshMetrics();
  },

  /**
   * Encerra a sessão de presença aberta do usuário.
   * @param userId ObjectId Mongo
   * @param endedAt Timestamp de fim
   */
  async endOpenSession(userId: Types.ObjectId, endedAt: Date): Promise<void> {
    const open = await presenceSessionRepository.findOpenByUserId(userId);
    if (open) {
      await presenceSessionRepository.close(open._id, endedAt);
      await this.refreshMetrics();
    }
  },

  /**
   * Processa mudança de presença (presenceUpdate).
   * @param _oldPresence Presença anterior (pode ser parcial)
   * @param newPresence Nova presença
   */
  async handlePresenceUpdate(_oldPresence: Presence | null, newPresence: Presence): Promise<void> {
    if (!guildService.isMonitoredGuild(newPresence.guild?.id)) {
      return;
    }

    if (!newPresence.user || newPresence.user.bot) {
      return;
    }

    const userId = await this.ensureUser(newPresence);
    const newStatus = mapDiscordPresenceStatus(newPresence.status);
    const now = new Date();

    const openSession = await presenceSessionRepository.findOpenByUserId(userId);
    const currentStatus = openSession?.status;

    if (currentStatus === newStatus) {
      return;
    }

    if (openSession) {
      await presenceSessionRepository.close(openSession._id, now);
    }

    await presenceSessionRepository.create({ userId, status: newStatus, startedAt: now });

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

    await this.refreshMetrics();
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
