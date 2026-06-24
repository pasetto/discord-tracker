import { FilterQuery, Types } from 'mongoose';
import {
  IPlannedAbsence,
  PlannedAbsenceModel,
  PlannedAbsenceStatus,
  PlannedAbsenceType,
} from '../db/models/PlannedAbsence';

/**
 * Shape mínimo de ausência usada em regras de inatividade.
 */
export interface PlannedAbsenceInterval {
  status: PlannedAbsenceStatus;
  startDate: Date;
  endDate: Date;
}

/**
 * Filtros aceitos para listagem de ausências.
 */
export interface PlannedAbsenceListFilters {
  from?: Date;
  to?: Date;
  status?: PlannedAbsenceStatus;
}

/**
 * Payload para criação de ausência planejada.
 */
export interface CreatePlannedAbsenceInput {
  organizationId: string;
  guildId: string;
  trackedUserId: string;
  discordId: string;
  type: PlannedAbsenceType;
  startDate: Date;
  endDate: Date;
  note?: string;
  createdBy: string;
}

/**
 * Payload para criação de solicitação de ausência via autoatendimento.
 */
export interface CreateAbsenceRequestInput {
  organizationId: string;
  guildId: string;
  trackedUserId: string;
  discordId: string;
  type: PlannedAbsenceType;
  startDate: Date;
  endDate: Date;
  note?: string;
  requestedBy: string;
}

/**
 * Campos permitidos para atualização de ausência planejada.
 */
export interface UpdatePlannedAbsenceInput {
  type?: PlannedAbsenceType;
  startDate?: Date;
  endDate?: Date;
  note?: string;
  discordId?: string;
}

/**
 * Converte string em ObjectId válido.
 * @param value Valor textual recebido da API
 * @param label Nome lógico do campo para mensagens
 * @returns ObjectId pronto para queries/persistência
 * @throws {Error} Quando o identificador for inválido
 */
function parseObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} inválido`);
  }

  return new Types.ObjectId(value);
}

/**
 * Retorna início do dia (00:00:00.000) em UTC.
 * @param reference Data base
 * @returns Data truncada para início do dia UTC
 */
function startOfUtcDay(reference: Date): Date {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Retorna fim do dia (23:59:59.999) em UTC.
 * @param reference Data base
 * @returns Data ajustada para fim do dia UTC
 */
function endOfUtcDay(reference: Date): Date {
  return new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate(), 23, 59, 59, 999),
  );
}

/**
 * Valida se intervalo de ausência é cronologicamente válido.
 * @param startDate Início da ausência
 * @param endDate Fim da ausência
 * @returns {void} Não retorna valor
 * @throws {Error} Quando endDate for menor que startDate
 */
function validateDateRange(startDate: Date, endDate: Date): void {
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error('startDate/endDate inválidos');
  }

  if (endDate.getTime() < startDate.getTime()) {
    throw new Error('endDate não pode ser anterior a startDate');
  }
}

/**
 * Resolve status com base no intervalo da ausência e data de referência.
 * @param startDate Data de início da ausência
 * @param endDate Data de fim da ausência
 * @param referenceDate Data de referência para cálculo do status
 * @returns Status coerente com o ciclo de vida da ausência
 */
function resolveStatusFromDates(startDate: Date, endDate: Date, referenceDate: Date): PlannedAbsenceStatus {
  if (endDate.getTime() < referenceDate.getTime()) {
    return 'completed';
  }

  if (startDate.getTime() > referenceDate.getTime()) {
    return 'scheduled';
  }

  return 'active';
}

/**
 * Indica se um membro está coberto por ausência planejada em uma data.
 * @param absences Lista de ausências do membro
 * @param date Data avaliada para exclusão de inatividade
 * @returns true quando existir ausência ativa/agendada cobrindo a data
 * @example
 * isOnPlannedAbsence([{ status: 'active', startDate: new Date('2026-06-01'), endDate: new Date('2026-06-30') }], new Date('2026-06-15'))
 */
export function isOnPlannedAbsence(absences: PlannedAbsenceInterval[], date: Date): boolean {
  const target = date.getTime();
  return absences.some((absence) => {
    if (absence.status !== 'active' && absence.status !== 'scheduled') {
      return false;
    }

    return absence.startDate.getTime() <= target && target <= absence.endDate.getTime();
  });
}

/**
 * Lista ausências por organização/guild com filtros opcionais.
 * @param organizationId Identificador da organização do tenant
 * @param guildId Identificador do servidor Discord
 * @param filters Filtros opcionais de período/status
 * @returns Coleção de ausências ordenadas por data de início
 */
export async function listPlannedAbsences(
  organizationId: string,
  guildId: string,
  filters: PlannedAbsenceListFilters = {},
): Promise<IPlannedAbsence[]> {
  const query: FilterQuery<IPlannedAbsence> = {
    organizationId: parseObjectId(organizationId, 'organizationId'),
    guildId,
  };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.from || filters.to) {
    query.startDate = {};
    query.endDate = {};
    if (filters.to) {
      query.startDate.$lte = endOfUtcDay(filters.to);
    }
    if (filters.from) {
      query.endDate.$gte = startOfUtcDay(filters.from);
    }
  }

  return PlannedAbsenceModel.find(query).sort({ startDate: 1, createdAt: 1 });
}

/**
 * Lista ausências ativas na data de referência para organização/guild.
 * @param organizationId Identificador da organização do tenant
 * @param guildId Identificador do servidor Discord
 * @param referenceDate Data de referência (default: agora)
 * @returns Ausências ativas ordenadas por data de fim
 */
export async function listActivePlannedAbsences(
  organizationId: string,
  guildId: string,
  referenceDate: Date = new Date(),
): Promise<IPlannedAbsence[]> {
  return PlannedAbsenceModel.find({
    organizationId: parseObjectId(organizationId, 'organizationId'),
    guildId,
    status: 'active',
    startDate: { $lte: referenceDate },
    endDate: { $gte: referenceDate },
  }).sort({ endDate: 1, startDate: 1 });
}

/**
 * Cria nova ausência planejada com status inicial automático.
 * @param input Dados obrigatórios para criação
 * @returns Documento recém-criado
 * @throws {Error} Quando datas ou identificadores forem inválidos
 */
export async function createPlannedAbsence(input: CreatePlannedAbsenceInput): Promise<IPlannedAbsence> {
  validateDateRange(input.startDate, input.endDate);
  const status = resolveStatusFromDates(input.startDate, input.endDate, new Date());

  return PlannedAbsenceModel.create({
    organizationId: parseObjectId(input.organizationId, 'organizationId'),
    guildId: input.guildId,
    trackedUserId: parseObjectId(input.trackedUserId, 'trackedUserId'),
    discordId: input.discordId,
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    note: input.note?.trim() || undefined,
    status,
    createdBy: parseObjectId(input.createdBy, 'createdBy'),
  });
}

/**
 * Cria uma solicitação de ausência com status pendente de aprovação.
 * @param input Dados obrigatórios da solicitação do colaborador
 * @returns Documento de ausência em estado `pending_approval`
 * @throws {Error} Quando datas ou identificadores forem inválidos
 */
export async function createAbsenceRequest(input: CreateAbsenceRequestInput): Promise<IPlannedAbsence> {
  validateDateRange(input.startDate, input.endDate);
  const requesterId = parseObjectId(input.requestedBy, 'requestedBy');

  return PlannedAbsenceModel.create({
    organizationId: parseObjectId(input.organizationId, 'organizationId'),
    guildId: input.guildId,
    trackedUserId: parseObjectId(input.trackedUserId, 'trackedUserId'),
    discordId: input.discordId,
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    note: input.note?.trim() || undefined,
    status: 'pending_approval',
    createdBy: requesterId,
    requestedBy: requesterId,
  });
}

/**
 * Lista solicitações de ausência por organização/guild.
 * @param organizationId Identificador da organização do tenant
 * @param guildId Identificador do servidor Discord
 * @param status Status desejado para filtro (default: pending_approval)
 * @returns Solicitações ordenadas por data de criação
 */
export async function listAbsenceRequests(
  organizationId: string,
  guildId: string,
  status: PlannedAbsenceStatus = 'pending_approval',
): Promise<IPlannedAbsence[]> {
  return PlannedAbsenceModel.find({
    organizationId: parseObjectId(organizationId, 'organizationId'),
    guildId,
    status,
  }).sort({ createdAt: -1, startDate: 1 });
}

/**
 * Aprova solicitação pendente e converte para status operacional de ausência.
 * @param organizationId Identificador da organização do tenant
 * @param guildId Identificador do servidor Discord
 * @param absenceId Identificador da solicitação
 * @param approvedBy Usuário responsável pela aprovação
 * @returns Documento aprovado ou null quando não encontrado
 */
export async function approveAbsenceRequest(
  organizationId: string,
  guildId: string,
  absenceId: string,
  approvedBy: string,
): Promise<IPlannedAbsence | null> {
  const current = await PlannedAbsenceModel.findOne({
    _id: parseObjectId(absenceId, 'absenceId'),
    organizationId: parseObjectId(organizationId, 'organizationId'),
    guildId,
    status: 'pending_approval',
  });

  if (!current) {
    return null;
  }

  current.status = resolveStatusFromDates(current.startDate, current.endDate, new Date());
  current.approvedBy = parseObjectId(approvedBy, 'approvedBy');
  current.approvedAt = new Date();
  await current.save();

  return current;
}

/**
 * Rejeita solicitação pendente e encerra o ciclo com status cancelado.
 * @param organizationId Identificador da organização do tenant
 * @param guildId Identificador do servidor Discord
 * @param absenceId Identificador da solicitação
 * @param rejectedBy Usuário responsável pela rejeição
 * @returns Documento rejeitado ou null quando não encontrado
 */
export async function rejectAbsenceRequest(
  organizationId: string,
  guildId: string,
  absenceId: string,
  rejectedBy: string,
): Promise<IPlannedAbsence | null> {
  const current = await PlannedAbsenceModel.findOne({
    _id: parseObjectId(absenceId, 'absenceId'),
    organizationId: parseObjectId(organizationId, 'organizationId'),
    guildId,
    status: 'pending_approval',
  });

  if (!current) {
    return null;
  }

  const rejectedByObjectId = parseObjectId(rejectedBy, 'rejectedBy');
  const rejectedAt = new Date();
  current.status = 'cancelled';
  current.rejectedBy = rejectedByObjectId;
  current.rejectedAt = rejectedAt;
  current.cancelledBy = rejectedByObjectId;
  current.cancelledAt = rejectedAt;
  await current.save();

  return current;
}

/**
 * Atualiza ausência existente quando ainda não cancelada.
 * @param organizationId Identificador da organização do tenant
 * @param guildId Identificador do servidor Discord
 * @param absenceId Identificador da ausência a alterar
 * @param input Campos permitidos de atualização
 * @returns Documento atualizado ou null quando não encontrado
 * @throws {Error} Quando datas atualizadas forem inválidas
 */
export async function updatePlannedAbsence(
  organizationId: string,
  guildId: string,
  absenceId: string,
  input: UpdatePlannedAbsenceInput,
): Promise<IPlannedAbsence | null> {
  const absenceObjectId = parseObjectId(absenceId, 'absenceId');
  const current = await PlannedAbsenceModel.findOne({
    _id: absenceObjectId,
    organizationId: parseObjectId(organizationId, 'organizationId'),
    guildId,
  });

  if (!current || current.status === 'cancelled') {
    return null;
  }

  const nextStartDate = input.startDate ?? current.startDate;
  const nextEndDate = input.endDate ?? current.endDate;
  validateDateRange(nextStartDate, nextEndDate);

  current.type = input.type ?? current.type;
  current.startDate = nextStartDate;
  current.endDate = nextEndDate;
  current.discordId = input.discordId ?? current.discordId;
  current.note = input.note?.trim() || undefined;
  current.status = resolveStatusFromDates(nextStartDate, nextEndDate, new Date());
  await current.save();

  return current;
}

/**
 * Cancela ausência existente mantendo histórico para auditoria.
 * @param organizationId Identificador da organização do tenant
 * @param guildId Identificador do servidor Discord
 * @param absenceId Identificador da ausência a cancelar
 * @param cancelledBy Usuário autenticado responsável pelo cancelamento
 * @returns true quando cancelamento foi aplicado, false quando ausência não encontrada
 */
export async function cancelPlannedAbsence(
  organizationId: string,
  guildId: string,
  absenceId: string,
  cancelledBy: string,
): Promise<boolean> {
  const result = await PlannedAbsenceModel.updateOne(
    {
      _id: parseObjectId(absenceId, 'absenceId'),
      organizationId: parseObjectId(organizationId, 'organizationId'),
      guildId,
      status: { $ne: 'cancelled' },
    },
    {
      $set: {
        status: 'cancelled',
        cancelledBy: parseObjectId(cancelledBy, 'cancelledBy'),
        cancelledAt: new Date(),
      },
    },
  );

  return result.modifiedCount > 0;
}

/**
 * Atualiza em lote status de ausências com base na data atual (cron diário).
 * @param referenceDate Data de referência para transição de estado
 * @returns Quantidade de documentos alterados por transição
 */
export async function transitionPlannedAbsenceStatuses(
  referenceDate: Date = new Date(),
): Promise<{ scheduledToActive: number; activeToCompleted: number }> {
  const dayStart = startOfUtcDay(referenceDate);
  const dayEnd = endOfUtcDay(referenceDate);

  const scheduledToActive = await PlannedAbsenceModel.updateMany(
    { status: 'scheduled', startDate: { $lte: dayEnd }, endDate: { $gte: dayStart } },
    { $set: { status: 'active' } },
  );

  const activeToCompleted = await PlannedAbsenceModel.updateMany(
    { status: 'active', endDate: { $lt: dayStart } },
    { $set: { status: 'completed' } },
  );

  return {
    scheduledToActive: scheduledToActive.modifiedCount,
    activeToCompleted: activeToCompleted.modifiedCount,
  };
}
