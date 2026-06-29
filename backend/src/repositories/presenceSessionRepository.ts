import { Types } from 'mongoose';
import { PresenceSession, IPresenceSession } from '../db/models/PresenceSession';
import { PresenceStatus } from '../config/env';
import { clipToWindow, unionDurationSeconds, type TimeIntervalMs } from '../utils/sessionTimeUtils';

const ACTIVE_PRESENCE_STATUSES = new Set<PresenceStatus>(['ONLINE', 'IDLE', 'DND']);

/**
 * Dados para criação de sessão de presença.
 */
export interface CreatePresenceSessionData {
  organizationId: Types.ObjectId;
  guildId: string;
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
  async findOpenByUserId(
    userId: Types.ObjectId,
    organizationId: Types.ObjectId,
    guildId: string,
  ): Promise<IPresenceSession | null> {
    return PresenceSession.findOne({ userId, organizationId, guildId, endedAt: null }).sort({ startedAt: -1 });
  },

  /**
   * Fecha TODAS as sessões de presença abertas do usuário no escopo informado.
   *
   * Corrige acúmulo de sessões órfãs sobrepostas (criadas por corridas de eventos
   * do Discord): garante que após uma troca de status reste no máximo uma sessão
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
    const open = await PresenceSession.find({ userId, organizationId, guildId, endedAt: null });
    for (const session of open) {
      const durationSeconds = Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000);
      session.endedAt = endedAt;
      session.durationSeconds = Math.max(0, durationSeconds);
      await session.save();
    }
    return open.length;
  },

  /**
   * Lista sessões de presença abertas, opcionalmente limitadas a um tenant/guild.
   * @param scope Escopo opcional de organização e guild
   * @returns Sessões sem endedAt
   */
  async findAllOpen(scope?: { organizationId: Types.ObjectId; guildId: string }): Promise<IPresenceSession[]> {
    return PresenceSession.find({ endedAt: null, ...(scope ?? {}) }).populate('userId');
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
   *
   * Usa a UNIÃO dos intervalos (não a soma bruta) para evitar contagem dupla
   * quando há sessões abertas sobrepostas do mesmo usuário (sessões órfãs). Uma
   * pessoa só tem um status por vez, então o total nunca pode exceder o tempo de
   * relógio decorrido no dia.
   * @param userIds IDs Mongo dos usuários
   * @param dayStart Início do dia UTC
   * @param now Momento atual
   * @returns Mapa userId → segundos online no dia
   */
  async sumTodayOnlineByUserIds(
    userIds: Types.ObjectId[],
    organizationId: Types.ObjectId,
    guildId: string,
    dayStart: Date,
    now: Date,
  ): Promise<Map<string, number>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const sessions = await PresenceSession.find({
      userId: { $in: userIds },
      organizationId,
      guildId,
      startedAt: { $lt: now },
      $or: [{ endedAt: null }, { endedAt: { $gt: dayStart } }],
    })
      .select('userId status startedAt endedAt')
      .lean<IPresenceSession[]>()
      .exec();

    const intervalsByUser = new Map<string, TimeIntervalMs[]>();

    for (const session of sessions) {
      if (!ACTIVE_PRESENCE_STATUSES.has(session.status)) {
        continue;
      }

      const interval = clipToWindow(session.startedAt, session.endedAt, dayStart, now);
      if (!interval) {
        continue;
      }

      const userKey = String(session.userId);
      const list = intervalsByUser.get(userKey) ?? [];
      list.push(interval);
      intervalsByUser.set(userKey, list);
    }

    const totals = new Map<string, number>();
    for (const [userKey, intervals] of intervalsByUser) {
      totals.set(userKey, unionDurationSeconds(intervals));
    }

    return totals;
  },

  /**
   * Agrega tempo de presença por usuário em um intervalo.
   *
   * Calcula a união dos intervalos por status para não duplicar sessões
   * sobrepostas em relatórios históricos.
   * @param start Início do período
   * @param end Fim do período
   * @returns Agregação por userId e status
   */
  async aggregateByPeriod(
    start: Date,
    end: Date,
    scope?: { organizationId: Types.ObjectId; guildId: string },
  ): Promise<
    Array<{
      _id: Types.ObjectId;
      idleSeconds: number;
      offlineSeconds: number;
    }>
  > {
    const sessions = await PresenceSession.find({
      ...(scope ?? {}),
      startedAt: { $lt: end },
      $or: [{ endedAt: null }, { endedAt: { $gt: start } }],
    })
      .select('userId status startedAt endedAt')
      .lean<IPresenceSession[]>()
      .exec();

    const idByKey = new Map<string, Types.ObjectId>();
    const idleByUser = new Map<string, TimeIntervalMs[]>();
    const offlineByUser = new Map<string, TimeIntervalMs[]>();

    for (const session of sessions) {
      const interval = clipToWindow(session.startedAt, session.endedAt, start, end);
      if (!interval) {
        continue;
      }

      const userKey = String(session.userId);
      idByKey.set(userKey, session.userId);

      if (session.status === 'IDLE') {
        const list = idleByUser.get(userKey) ?? [];
        list.push(interval);
        idleByUser.set(userKey, list);
      } else if (session.status === 'OFFLINE' || session.status === 'INVISIBLE') {
        const list = offlineByUser.get(userKey) ?? [];
        list.push(interval);
        offlineByUser.set(userKey, list);
      }
    }

    return [...idByKey.entries()].map(([userKey, userId]) => ({
      _id: userId,
      idleSeconds: unionDurationSeconds(idleByUser.get(userKey) ?? []),
      offlineSeconds: unionDurationSeconds(offlineByUser.get(userKey) ?? []),
    }));
  },
};
