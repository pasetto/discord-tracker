import { Types } from 'mongoose';
import { PresenceSession, IPresenceSession } from '../db/models/PresenceSession';
import { PresenceStatus } from '../config/env';
import { overlapSeconds } from '../utils/sessionTimeUtils';

const ACTIVE_PRESENCE_STATUSES = new Set<PresenceStatus>(['ONLINE', 'IDLE', 'DND']);

/**
 * Dados para criação de sessão de presença.
 */
export interface CreatePresenceSessionData {
  userId: Types.ObjectId;
  status: PresenceStatus;
  startedAt: Date;
}

/**
 * Repositório de sessões de presença.
 */
export const presenceSessionRepository = {
  /**
   * Cria uma nova sessão de presença aberta.
   * @param data Dados da sessão
   * @returns Sessão criada
   */
  async create(data: CreatePresenceSessionData): Promise<IPresenceSession> {
    return PresenceSession.create({
      ...data,
      endedAt: null,
      durationSeconds: null,
    });
  },

  /**
   * Fecha uma sessão de presença calculando duração.
   * @param sessionId ID da sessão
   * @param endedAt Momento de encerramento
   * @returns Sessão atualizada ou null
   */
  async close(sessionId: Types.ObjectId | string, endedAt: Date): Promise<IPresenceSession | null> {
    const session = await PresenceSession.findById(sessionId);
    if (!session || session.endedAt) {
      return session;
    }

    const durationSeconds = Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000);
    session.endedAt = endedAt;
    session.durationSeconds = Math.max(0, durationSeconds);
    await session.save();
    return session;
  },

  /**
   * Busca sessão de presença aberta do usuário.
   * @param userId ID Mongo do usuário
   * @returns Sessão aberta ou null
   */
  async findOpenByUserId(userId: Types.ObjectId): Promise<IPresenceSession | null> {
    return PresenceSession.findOne({ userId, endedAt: null }).sort({ startedAt: -1 });
  },

  /**
   * Lista todas as sessões de presença abertas.
   * @returns Sessões sem endedAt
   */
  async findAllOpen(): Promise<IPresenceSession[]> {
    return PresenceSession.find({ endedAt: null }).populate('userId');
  },

  /**
   * Conta sessões de presença abertas.
   * @returns Quantidade
   */
  async countOpen(): Promise<number> {
    return PresenceSession.countDocuments({ endedAt: null });
  },

  /**
   * Soma segundos online (ONLINE/IDLE/DND) no dia por usuário.
   * @param userIds IDs Mongo dos usuários
   * @param dayStart Início do dia UTC
   * @param now Momento atual
   * @returns Mapa userId → segundos online no dia
   */
  async sumTodayOnlineByUserIds(
    userIds: Types.ObjectId[],
    dayStart: Date,
    now: Date,
  ): Promise<Map<string, number>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const sessions = await PresenceSession.find({
      userId: { $in: userIds },
      startedAt: { $lt: now },
      $or: [{ endedAt: null }, { endedAt: { $gt: dayStart } }],
    })
      .select('userId status startedAt endedAt')
      .lean<IPresenceSession[]>()
      .exec();

    const totals = new Map<string, number>();

    for (const session of sessions) {
      if (!ACTIVE_PRESENCE_STATUSES.has(session.status)) {
        continue;
      }

      const userKey = String(session.userId);
      const seconds = overlapSeconds(session.startedAt, session.endedAt, dayStart, now);
      totals.set(userKey, (totals.get(userKey) ?? 0) + seconds);
    }

    return totals;
  },

  /**
   * Agrega tempo de presença por usuário em um intervalo.
   * @param start Início do período
   * @param end Fim do período
   * @returns Agregação por userId e status
   */
  async aggregateByPeriod(
    start: Date,
    end: Date,
  ): Promise<
    Array<{
      _id: Types.ObjectId;
      idleSeconds: number;
      offlineSeconds: number;
    }>
  > {
    return PresenceSession.aggregate([
      {
        $match: {
          startedAt: { $gte: start, $lt: end },
          durationSeconds: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$userId',
          idleSeconds: {
            $sum: {
              $cond: [{ $eq: ['$status', 'IDLE'] }, '$durationSeconds', 0],
            },
          },
          offlineSeconds: {
            $sum: {
              $cond: [
                { $in: ['$status', ['OFFLINE', 'INVISIBLE']] },
                '$durationSeconds',
                0,
              ],
            },
          },
        },
      },
    ]);
  },
};
