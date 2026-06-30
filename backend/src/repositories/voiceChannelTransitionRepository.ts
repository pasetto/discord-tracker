import { Types } from 'mongoose';
import {
  VoiceChannelTransitionModel,
  type IVoiceChannelTransition,
} from '../db/models/VoiceChannelTransition';
import type { VoiceEventType, VoiceSessionType } from '../config/env';

/** Payload para registrar transição de canal de voz. */
export interface CreateVoiceChannelTransitionInput {
  organizationId: string;
  guildId: string;
  userId: Types.ObjectId;
  discordId: string;
  displayName: string;
  eventType: VoiceEventType;
  fromChannelId?: string;
  fromChannelName?: string;
  toChannelId?: string;
  toChannelName?: string;
  fromSessionType?: VoiceSessionType;
  toSessionType?: VoiceSessionType;
  fromIgnored: boolean;
  toIgnored: boolean;
  countsAsCollaboration: boolean;
  occurredAt: Date;
}

/**
 * Monta chave de deduplicação para transições quase idênticas (ex.: cluster PM2 triplicando eventos).
 * @param transition Transição persistida ou em criação
 * @returns Chave estável por segundo civil
 */
export function buildVoiceTransitionDedupKey(transition: {
  discordId: string;
  eventType: VoiceEventType;
  fromChannelId?: string | null;
  toChannelId?: string | null;
  fromChannelName?: string | null;
  toChannelName?: string | null;
  occurredAt: Date;
}): string {
  const occurredSecond = Math.floor(transition.occurredAt.getTime() / 1000);
  const from = transition.fromChannelId ?? transition.fromChannelName ?? '';
  const to = transition.toChannelId ?? transition.toChannelName ?? '';
  return `${transition.discordId}|${transition.eventType}|${from}|${to}|${occurredSecond}`;
}

/**
 * Remove duplicatas consecutivas de transições (mesmo membro/evento/canais no mesmo segundo).
 * @param transitions Lista ordenada da mais recente para a mais antiga
 * @param limit Quantidade máxima após deduplicação
 * @returns Feed sem repetições de eventos espelhados
 */
export function deduplicateVoiceTransitionFeed(
  transitions: IVoiceChannelTransition[],
  limit: number,
): IVoiceChannelTransition[] {
  const seen = new Set<string>();
  const unique: IVoiceChannelTransition[] = [];

  for (const transition of transitions) {
    const key = buildVoiceTransitionDedupKey(transition);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(transition);
    if (unique.length >= limit) {
      break;
    }
  }

  return unique;
}

/**
 * Repositório de transições de canal de voz (entrada, saída e trocas).
 */
export const voiceChannelTransitionRepository = {
  /**
   * Persiste uma transição de canal de voz.
   * @param input Dados do evento
   * @returns Documento criado
   */
  async create(input: CreateVoiceChannelTransitionInput): Promise<IVoiceChannelTransition> {
    return VoiceChannelTransitionModel.create({
      organizationId: new Types.ObjectId(input.organizationId),
      guildId: input.guildId,
      userId: input.userId,
      discordId: input.discordId,
      displayName: input.displayName,
      eventType: input.eventType,
      fromChannelId: input.fromChannelId,
      fromChannelName: input.fromChannelName,
      toChannelId: input.toChannelId,
      toChannelName: input.toChannelName,
      fromSessionType: input.fromSessionType,
      toSessionType: input.toSessionType,
      fromIgnored: input.fromIgnored,
      toIgnored: input.toIgnored,
      countsAsCollaboration: input.countsAsCollaboration,
      occurredAt: input.occurredAt,
    });
  },

  /**
   * Indica se já existe transição equivalente nos últimos segundos (idempotência anti-cluster).
   * @param input Dados do evento candidato
   * @param windowMs Janela de tolerância em milissegundos
   * @returns true quando um evento espelhado já foi persistido
   */
  async hasRecentDuplicate(
    input: Pick<
      CreateVoiceChannelTransitionInput,
      'organizationId' | 'guildId' | 'discordId' | 'eventType' | 'fromChannelId' | 'toChannelId' | 'occurredAt'
    >,
    windowMs = 2_000,
  ): Promise<boolean> {
    const since = new Date(input.occurredAt.getTime() - windowMs);
    const existing = await VoiceChannelTransitionModel.findOne({
      organizationId: new Types.ObjectId(input.organizationId),
      guildId: input.guildId,
      discordId: input.discordId,
      eventType: input.eventType,
      fromChannelId: input.fromChannelId ?? null,
      toChannelId: input.toChannelId ?? null,
      occurredAt: { $gte: since, $lte: input.occurredAt },
    })
      .select('_id')
      .lean()
      .exec();

    return existing !== null;
  },

  /**
   * Lista transições recentes do guild para feed ao vivo.
   * @param organizationId ID da organização
   * @param guildId ID do servidor Discord
   * @param limit Quantidade máxima de registros
   * @returns Transições mais recentes primeiro (sem duplicatas de cluster)
   */
  async findRecentByGuild(organizationId: string, guildId: string, limit = 30): Promise<IVoiceChannelTransition[]> {
    const fetchLimit = Math.min(Math.max(limit * 5, limit), 100);
    const raw = await VoiceChannelTransitionModel.find({ organizationId, guildId })
      .sort({ occurredAt: -1 })
      .limit(fetchLimit)
      .lean<IVoiceChannelTransition[]>()
      .exec();

    return deduplicateVoiceTransitionFeed(raw, limit);
  },

  /**
   * Lista transições do dia corrente por membro para montar histórico de salas visitadas.
   * @param organizationId ID da organização
   * @param guildId ID do servidor Discord
   * @param dayStart Início do dia (timezone da org)
   * @returns Transições do período
   */
  async findSinceByGuild(
    organizationId: string,
    guildId: string,
    dayStart: Date,
  ): Promise<IVoiceChannelTransition[]> {
    return VoiceChannelTransitionModel.find({
      organizationId,
      guildId,
      occurredAt: { $gte: dayStart },
    })
      .sort({ occurredAt: 1 })
      .lean<IVoiceChannelTransition[]>()
      .exec();
  },
};
