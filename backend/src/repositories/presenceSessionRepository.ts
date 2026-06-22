import { Types } from 'mongoose';
import { PresenceSession, IPresenceSession } from '../db/models/PresenceSession';
import { PresenceStatus } from '../config/env';

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
