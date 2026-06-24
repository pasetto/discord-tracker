import { Types } from 'mongoose';
import { InactivitySettingsModel, type IInactivitySettings } from '../db/models/InactivitySettings';
import { getInactivityThresholdSettings, type InactivityThresholdSettings } from './inactivityService';

/**
 * Payload permitido para atualização de configurações de inatividade.
 */
export interface InactivitySettingsUpdateInput {
  inactiveAfterBusinessDays?: number;
  zeroVoiceCollaborationDays?: number;
  lateStartThresholdPercent?: number;
  minCollaborationPercentOfElapsed?: number;
  notifyManagerPush?: boolean;
  notifyManagerEmail?: boolean;
}

/**
 * DTO serializável de configurações de inatividade por guild.
 */
export interface InactivitySettingsDto extends InactivityThresholdSettings {
  guildId: string;
  updatedAt?: Date;
}

/**
 * Converte string em ObjectId válido.
 * @param value Valor textual
 * @param label Nome do campo para mensagens
 * @returns ObjectId pronto para query
 * @throws {Error} Quando inválido
 */
function parseObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} inválido`);
  }
  return new Types.ObjectId(value);
}

/**
 * Valida campos numéricos opcionais do payload de settings.
 * @param input Payload recebido da API
 * @throws {Error} Quando algum valor estiver fora do intervalo permitido
 */
function assertValidUpdateInput(input: InactivitySettingsUpdateInput): void {
  if (input.inactiveAfterBusinessDays !== undefined && input.inactiveAfterBusinessDays < 1) {
    throw new Error('inactiveAfterBusinessDays deve ser >= 1');
  }
  if (input.zeroVoiceCollaborationDays !== undefined && input.zeroVoiceCollaborationDays < 1) {
    throw new Error('zeroVoiceCollaborationDays deve ser >= 1');
  }
  if (
    input.lateStartThresholdPercent !== undefined
    && (input.lateStartThresholdPercent < 1 || input.lateStartThresholdPercent > 100)
  ) {
    throw new Error('lateStartThresholdPercent deve estar entre 1 e 100');
  }
  if (
    input.minCollaborationPercentOfElapsed !== undefined
    && (input.minCollaborationPercentOfElapsed < 1 || input.minCollaborationPercentOfElapsed > 100)
  ) {
    throw new Error('minCollaborationPercentOfElapsed deve estar entre 1 e 100');
  }
}

/**
 * Monta DTO de resposta a partir do documento persistido ou defaults.
 * @param guildId Guild monitorada
 * @param document Documento opcional do banco
 * @returns Configuração efetiva para a UI
 */
function toSettingsDto(guildId: string, document?: IInactivitySettings | null): InactivitySettingsDto {
  const thresholds = getInactivityThresholdSettings(document ?? undefined);
  return {
    guildId,
    ...thresholds,
    updatedAt: document?.updatedAt,
  };
}

/**
 * Busca configurações de inatividade da guild, retornando defaults quando ausentes.
 * @param organizationId Identificador textual da organização
 * @param guildId Identificador da guild no Discord
 * @returns Configuração efetiva (sempre preenchida com defaults)
 */
export async function getInactivitySettings(
  organizationId: string,
  guildId: string,
): Promise<InactivitySettingsDto> {
  const organizationObjectId = parseObjectId(organizationId, 'organizationId');
  const document = await InactivitySettingsModel.findOne({
    organizationId: organizationObjectId,
    guildId,
  })
    .lean()
    .exec();

  return toSettingsDto(guildId, document as IInactivitySettings | null);
}

/**
 * Cria ou atualiza configurações de inatividade da guild.
 * @param organizationId Identificador textual da organização
 * @param guildId Identificador da guild no Discord
 * @param userId Usuário autenticado responsável pela alteração
 * @param input Campos permitidos para atualização parcial
 * @returns Configuração persistida após upsert
 */
export async function upsertInactivitySettings(
  organizationId: string,
  guildId: string,
  userId: string,
  input: InactivitySettingsUpdateInput,
): Promise<InactivitySettingsDto> {
  assertValidUpdateInput(input);

  const organizationObjectId = parseObjectId(organizationId, 'organizationId');
  const userObjectId = parseObjectId(userId, 'userId');
  const defaults = getInactivityThresholdSettings();

  const toSet: Record<string, unknown> = {
    updatedBy: userObjectId,
    inactiveAfterBusinessDays: input.inactiveAfterBusinessDays ?? defaults.inactiveAfterBusinessDays,
    zeroVoiceCollaborationDays: input.zeroVoiceCollaborationDays ?? defaults.zeroVoiceCollaborationDays,
    lateStartThresholdPercent: input.lateStartThresholdPercent ?? defaults.lateStartThresholdPercent,
    minCollaborationPercentOfElapsed: input.minCollaborationPercentOfElapsed ?? defaults.minCollaborationPercentOfElapsed,
    notifyManagerPush: input.notifyManagerPush ?? defaults.notifyManagerPush,
    notifyManagerEmail: input.notifyManagerEmail ?? defaults.notifyManagerEmail,
  };

  const document = await InactivitySettingsModel.findOneAndUpdate(
    { organizationId: organizationObjectId, guildId },
    {
      $set: toSet,
      $setOnInsert: {
        organizationId: organizationObjectId,
        guildId,
      },
    },
    { new: true, upsert: true },
  );

  return toSettingsDto(guildId, document as IInactivitySettings | null);
}
