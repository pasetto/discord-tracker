import { Types } from 'mongoose';
import { VoiceSession, IVoiceSession } from '../db/models/VoiceSession';
import { VoiceSessionType } from '../config/env';

/**
 * Dados para criação de sessão de voz.
 */
export interface CreateVoiceSessionData {
  userId: Types.ObjectId;
  channelId: string;
  channelName: string;
  startedAt: Date;
  isIgnoredChannel: boolean;
  sessionType: VoiceSessionType;
}

/**
 * Repositório de sessões de voz.
 */
export const voiceSessionRepository = {
  /**
   * Cria uma nova sessão de voz aberta.
   * @param data Dados da sessão
   * @returns Sessão criada
   */
  async create(data: CreateVoiceSessionData): Promise<IVoiceSession> {
    return VoiceSession.create({
      ...data,
      endedAt: null,
      durationSeconds: null,
    });
  },

  /**
   * Fecha uma sessão calculando duração.
   * @param sessionId ID da sessão
   * @param endedAt Momento de encerramento
   * @returns Sessão atualizada ou null
   */
  async close(sessionId: Types.ObjectId | string, endedAt: Date): Promise<IVoiceSession | null> {
    const session = await VoiceSession.findById(sessionId);
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
   * Busca sessão de voz aberta do usuário.
   * @param userId ID Mongo do usuário
   * @returns Sessão aberta ou null
   */
  async findOpenByUserId(userId: Types.ObjectId): Promise<IVoiceSession | null> {
    return VoiceSession.findOne({ userId, endedAt: null }).sort({ startedAt: -1 });
  },

  /**
   * Lista todas as sessões de voz abertas.
   * @returns Sessões sem endedAt
   */
  async findAllOpen(): Promise<IVoiceSession[]> {
    return VoiceSession.find({ endedAt: null }).populate('userId');
  },

  /**
   * Conta sessões de voz abertas.
   * @returns Quantidade
   */
  async countOpen(): Promise<number> {
    return VoiceSession.countDocuments({ endedAt: null });
  },

  /**
   * Agrega tempo de voz por usuário em um intervalo de datas.
   * @param start Início do período
   * @param end Fim do período
   * @returns Agregação por userId e sessionType
   */
  async aggregateByPeriod(
    start: Date,
    end: Date,
  ): Promise<
    Array<{
      _id: Types.ObjectId;
      productiveSeconds: number;
      voiceSeconds: number;
      afkSeconds: number;
      lunchSeconds: number;
    }>
  > {
    return VoiceSession.aggregate([
      {
        $match: {
          startedAt: { $gte: start, $lt: end },
          durationSeconds: { $ne: null },
        },
      },
      {
        $group: {
          _id: '$userId',
          voiceSeconds: { $sum: '$durationSeconds' },
          productiveSeconds: {
            $sum: {
              $cond: [{ $eq: ['$sessionType', 'VOICE'] }, '$durationSeconds', 0],
            },
          },
          afkSeconds: {
            $sum: {
              $cond: [{ $eq: ['$sessionType', 'AFK'] }, '$durationSeconds', 0],
            },
          },
          lunchSeconds: {
            $sum: {
              $cond: [{ $eq: ['$sessionType', 'LUNCH'] }, '$durationSeconds', 0],
            },
          },
        },
      },
    ]);
  },
};
