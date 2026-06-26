import { Types } from 'mongoose';
import { VoiceSession, IVoiceSession } from '../db/models/VoiceSession';
import { VoiceSessionType } from '../config/env';
import { clipToWindow, unionDurationSeconds, type TimeIntervalMs } from '../utils/sessionTimeUtils';

/** Totais diários de voz por usuário. */
export interface VoiceDailyTotals {
  collaborationSeconds: number;
  inactiveSeconds: number;
}

/**
 * Dados para criação de sessão de voz.
 */
export interface CreateVoiceSessionData {
  organizationId: Types.ObjectId;
  guildId: string;
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
  async findOpenByUserId(
    userId: Types.ObjectId,
    organizationId: Types.ObjectId,
    guildId: string,
  ): Promise<IVoiceSession | null> {
    return VoiceSession.findOne({ userId, organizationId, guildId, endedAt: null }).sort({ startedAt: -1 });
  },

  /**
   * Fecha TODAS as sessões de voz abertas do usuário no escopo informado.
   *
   * Corrige acúmulo de sessões órfãs sobrepostas (criadas por corridas de eventos
   * do Discord): garante que após sair/trocar de canal reste no máximo uma sessão
   * aberta por usuário.
   * @param userId ID Mongo do usuário
   * @param organizationId ID da organização
   * @param guildId ID do servidor Discord
   * @param endedAt Momento de encerramento
   * @returns Quantidade de sessões fechadas
   */
  async closeAllOpenByUserId(
    userId: Types.ObjectId,
    organizationId: Types.ObjectId,
    guildId: string,
    endedAt: Date,
  ): Promise<number> {
    const open = await VoiceSession.find({ userId, organizationId, guildId, endedAt: null });
    for (const session of open) {
      const durationSeconds = Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000);
      session.endedAt = endedAt;
      session.durationSeconds = Math.max(0, durationSeconds);
      await session.save();
    }
    return open.length;
  },

  /**
   * Lista sessões de voz abertas, opcionalmente limitadas a um tenant/guild.
   * @param scope Escopo opcional de organização e guild
   * @returns Sessões sem endedAt
   */
  async findAllOpen(scope?: { organizationId: Types.ObjectId; guildId: string }): Promise<IVoiceSession[]> {
    return VoiceSession.find({ endedAt: null, ...(scope ?? {}) }).populate('userId');
  },

  /**
   * Conta sessões de voz abertas.
   * @returns Quantidade
   */
  async countOpen(): Promise<number> {
    return VoiceSession.countDocuments({ endedAt: null });
  },

  /**
   * Lista sessões de voz que intersectam o dia corrente para um conjunto de usuários.
   * @param userIds IDs Mongo dos usuários
   * @param dayStart Início do dia UTC
   * @param now Momento atual (fim da janela)
   * @returns Sessões fechadas ou abertas que tocam o dia
   */
  async findOverlappingDay(
    userIds: Types.ObjectId[],
    organizationId: Types.ObjectId,
    guildId: string,
    dayStart: Date,
    now: Date,
  ): Promise<IVoiceSession[]> {
    if (userIds.length === 0) {
      return [];
    }

    return VoiceSession.find({
      userId: { $in: userIds },
      organizationId,
      guildId,
      startedAt: { $lt: now },
      $or: [{ endedAt: null }, { endedAt: { $gt: dayStart } }],
    })
      .select('userId startedAt endedAt isIgnoredChannel sessionType')
      .lean<IVoiceSession[]>()
      .exec();
  },

  /**
   * Soma segundos de colaboração e inatividade de voz no dia por usuário.
   *
   * Usa a UNIÃO dos intervalos por bucket (colaboração e inatividade) em vez da
   * soma bruta, evitando contagem dupla quando há sessões abertas sobrepostas do
   * mesmo usuário (sessões órfãs). Como o usuário só fica em um canal por vez,
   * cada bucket nunca excede o tempo de relógio decorrido no dia.
   * @param userIds IDs Mongo dos usuários
   * @param dayStart Início do dia UTC
   * @param now Momento atual
   * @returns Mapa userId → totais diários
   */
  async sumTodayByUserIds(
    userIds: Types.ObjectId[],
    organizationId: Types.ObjectId,
    guildId: string,
    dayStart: Date,
    now: Date,
  ): Promise<Map<string, VoiceDailyTotals>> {
    const sessions = await this.findOverlappingDay(userIds, organizationId, guildId, dayStart, now);

    const collaborationByUser = new Map<string, TimeIntervalMs[]>();
    const inactiveByUser = new Map<string, TimeIntervalMs[]>();

    for (const session of sessions) {
      const interval = clipToWindow(session.startedAt, session.endedAt, dayStart, now);
      if (!interval) {
        continue;
      }

      const userKey = String(session.userId);
      const isCollaboration = !session.isIgnoredChannel && session.sessionType === 'VOICE';
      const target = isCollaboration ? collaborationByUser : inactiveByUser;
      const list = target.get(userKey) ?? [];
      list.push(interval);
      target.set(userKey, list);
    }

    const totals = new Map<string, VoiceDailyTotals>();
    const userKeys = new Set<string>([...collaborationByUser.keys(), ...inactiveByUser.keys()]);

    for (const userKey of userKeys) {
      totals.set(userKey, {
        collaborationSeconds: unionDurationSeconds(collaborationByUser.get(userKey) ?? []),
        inactiveSeconds: unionDurationSeconds(inactiveByUser.get(userKey) ?? []),
      });
    }

    return totals;
  },

  /**
   * Retorna a última colaboração em voz por userId core.
   * @param userIds IDs Mongo dos usuários core
   * @returns Mapa userId → instante da última sessão VOICE colaborativa
   */
  async getLastCollaborationAtByUserIds(
    userIds: Types.ObjectId[],
    organizationId: Types.ObjectId,
    guildId: string,
  ): Promise<Map<string, Date>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const rows = await VoiceSession.aggregate<{ _id: Types.ObjectId; lastAt: Date }>([
      {
        $match: {
          userId: { $in: userIds },
          organizationId,
          guildId,
          isIgnoredChannel: false,
          sessionType: 'VOICE',
        },
      },
      {
        $group: {
          _id: '$userId',
          lastAt: {
            $max: {
              $ifNull: ['$endedAt', '$startedAt'],
            },
          },
        },
      },
    ]);

    return new Map(rows.map((row) => [String(row._id), row.lastAt]));
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
    scope?: { organizationId: Types.ObjectId; guildId: string },
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
          ...(scope ?? {}),
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
