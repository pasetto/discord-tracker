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
   * Lista transições recentes do guild para feed ao vivo.
   * @param organizationId ID da organização
   * @param guildId ID do servidor Discord
   * @param limit Quantidade máxima de registros
   * @returns Transições mais recentes primeiro
   */
  async findRecentByGuild(organizationId: string, guildId: string, limit = 30): Promise<IVoiceChannelTransition[]> {
    return VoiceChannelTransitionModel.find({ organizationId, guildId })
      .sort({ occurredAt: -1 })
      .limit(limit)
      .lean<IVoiceChannelTransition[]>()
      .exec();
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
