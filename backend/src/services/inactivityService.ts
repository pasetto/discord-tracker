import { FilterQuery, Types } from 'mongoose';
import { InactivitySettingsModel, type IInactivitySettings } from '../db/models/InactivitySettings';
import {
  InactivitySnapshotModel,
  type InactivitySnapshotEntry,
  type InactivityStatus,
} from '../db/models/InactivitySnapshot';
import { MemberCategoryModel } from '../db/models/MemberCategory';
import { PlannedAbsenceModel, type IPlannedAbsence } from '../db/models/PlannedAbsence';
import { TextActivityEventModel } from '../db/models/TextActivityEvent';
import { TrackedUserModel } from '../db/models/TrackedUser';
import { WorkCalendarModel, createDefaultWorkWeek, type WorkCalendar } from '../db/models/WorkCalendar';
import { isOnPlannedAbsence } from './plannedAbsenceService';
import { isBusinessDay } from './workCalendarService';

/**
 * Configuração mínima necessária para cálculo de status de inatividade.
 */
export interface InactivityThresholdSettings {
  inactiveAfterBusinessDays: number;
  zeroVoiceCollaborationDays: number;
  notifyManagerPush: boolean;
  notifyManagerEmail: boolean;
}

/**
 * Entrada necessária para classificar status de inatividade de um membro.
 */
export interface ComputeInactivityStatusInput {
  settings: InactivityThresholdSettings;
  businessDaysInactive: number;
  onPlannedAbsence: boolean;
  hasRecentText: boolean;
  hasRecentPresence: boolean;
  zeroVoiceDays: number;
}

/**
 * Parâmetros para contagem de dias úteis entre duas datas.
 */
export interface ComputeBusinessDaysBetweenInput {
  calendar: Pick<WorkCalendar, 'workWeek' | 'holidays'>;
  from: Date;
  to: Date;
  isOnPlannedAbsenceAt(date: Date): boolean;
}

/**
 * Filtro opcional para relatório semanal de inatividade.
 */
export interface InactivityReportFilters {
  categoryId?: string;
}

/**
 * Relatório semanal de inatividade utilizado pela API de "quem sumiu".
 */
export interface InactivityWeeklyReport {
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  entries: InactivitySnapshotEntry[];
  plannedAbsenceEntries: InactivitySnapshotEntry[];
}

/**
 * Trunca uma data para o início do dia em UTC.
 * @param value Data de referência
 * @returns Data normalizada para 00:00:00.000 UTC
 */
function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Converte string em ObjectId válido.
 * @param value Valor textual recebido da rota
 * @param label Nome lógico do campo para mensagens
 * @returns ObjectId pronto para query Mongo
 * @throws {Error} Quando o identificador for inválido
 */
function parseObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} inválido`);
  }
  return new Types.ObjectId(value);
}

/**
 * Retorna configuração efetiva de inatividade com fallback de defaults.
 * @param settings Documento opcional persistido no banco
 * @returns Configuração já normalizada para cálculo
 */
function normalizeThresholdSettings(settings?: Pick<IInactivitySettings, keyof InactivityThresholdSettings>): InactivityThresholdSettings {
  return {
    inactiveAfterBusinessDays: settings?.inactiveAfterBusinessDays ?? 2,
    zeroVoiceCollaborationDays: settings?.zeroVoiceCollaborationDays ?? 3,
    notifyManagerPush: settings?.notifyManagerPush ?? true,
    notifyManagerEmail: settings?.notifyManagerEmail ?? false,
  };
}

/**
 * Determina o status final de inatividade de um membro.
 * @param input Métricas de sinais e limiares da organização
 * @returns Status calculado para o relatório
 * @example
 * computeInactivityStatus({
 *   settings: { inactiveAfterBusinessDays: 2, zeroVoiceCollaborationDays: 3, notifyManagerPush: true, notifyManagerEmail: false },
 *   businessDaysInactive: 3,
 *   onPlannedAbsence: false,
 *   hasRecentText: false,
 *   hasRecentPresence: false,
 *   zeroVoiceDays: 3,
 * }) // 'missing'
 */
export function computeInactivityStatus(input: ComputeInactivityStatusInput): InactivityStatus {
  if (input.onPlannedAbsence) {
    return 'on_planned_absence';
  }

  const hasNoRecentSignals = !input.hasRecentText && !input.hasRecentPresence;
  if (
    hasNoRecentSignals
    && input.businessDaysInactive >= input.settings.inactiveAfterBusinessDays
    && input.zeroVoiceDays >= input.settings.inactiveAfterBusinessDays
  ) {
    return 'missing';
  }

  if (
    (input.hasRecentText || input.hasRecentPresence)
    && input.zeroVoiceDays >= input.settings.zeroVoiceCollaborationDays
  ) {
    return 'low_voice_collaboration';
  }

  return 'active';
}

/**
 * Conta dias úteis entre duas datas considerando calendário e PTO.
 * @param input Parâmetros de intervalo e regras de exclusão
 * @returns Total de dias úteis válidos no período
 */
export function computeBusinessDaysBetween(input: ComputeBusinessDaysBetweenInput): number {
  const fromDay = startOfUtcDay(input.from);
  const toDay = startOfUtcDay(input.to);
  if (toDay.getTime() <= fromDay.getTime()) {
    return 0;
  }

  let businessDays = 0;
  for (
    let cursor = new Date(fromDay.getTime() + 24 * 60 * 60 * 1000);
    cursor.getTime() <= toDay.getTime();
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    if (!isBusinessDay(input.calendar, cursor)) {
      continue;
    }
    if (input.isOnPlannedAbsenceAt(cursor)) {
      continue;
    }
    businessDays += 1;
  }

  return businessDays;
}

/**
 * Resolve o último evento de texto por discordId para um conjunto de membros.
 * @param organizationId Organização (tenant) alvo
 * @param guildId Guild alvo
 * @param discordIds Lista de usuários a consultar
 * @returns Mapa de discordId para data da última atividade textual
 */
async function getLastTextActivityByDiscordId(
  organizationId: Types.ObjectId,
  guildId: string,
  discordIds: string[],
): Promise<Map<string, Date>> {
  if (discordIds.length === 0) {
    return new Map<string, Date>();
  }

  const rows = await TextActivityEventModel.aggregate<{ _id: string; lastTextActivityAt: Date }>([
    { $match: { organizationId, guildId, discordId: { $in: discordIds } } },
    { $group: { _id: '$discordId', lastTextActivityAt: { $max: '$occurredAt' } } },
  ]);

  return new Map(rows.map((row) => [row._id, row.lastTextActivityAt]));
}

/**
 * Resolve ausências planejadas (scheduled/active) para membros de uma guild.
 * @param organizationId Organização (tenant) alvo
 * @param guildId Guild alvo
 * @param discordIds Usuários que farão parte do cálculo
 * @returns Mapa de discordId para lista de ausências
 */
async function getPlannedAbsencesByDiscordId(
  organizationId: Types.ObjectId,
  guildId: string,
  discordIds: string[],
): Promise<Map<string, IPlannedAbsence[]>> {
  if (discordIds.length === 0) {
    return new Map<string, IPlannedAbsence[]>();
  }

  const absences = await PlannedAbsenceModel.find({
    organizationId,
    guildId,
    discordId: { $in: discordIds },
    status: { $in: ['scheduled', 'active'] },
  }).sort({ startDate: 1 });

  const byDiscordId = new Map<string, IPlannedAbsence[]>();
  for (const absence of absences) {
    const current = byDiscordId.get(absence.discordId) ?? [];
    current.push(absence);
    byDiscordId.set(absence.discordId, current);
  }
  return byDiscordId;
}

/**
 * Resolve nomes de categoria por `categoryId` para enriquecer o relatório.
 * @param organizationId Organização (tenant) alvo
 * @param guildId Guild alvo
 * @returns Mapa de categoryId para nome
 */
async function getCategoryNamesById(
  organizationId: Types.ObjectId,
  guildId: string,
): Promise<Map<string, string>> {
  const categories = await MemberCategoryModel.find({ organizationId, guildId }).select({ _id: 1, name: 1 }).lean().exec();
  return new Map(categories.map((item) => [String(item._id), item.name]));
}

/**
 * Retorna calendário da organização para a guild, com fallback padrão.
 * @param organizationId Organização (tenant) alvo
 * @param guildId Guild alvo
 * @returns Calendário pronto para cálculo de dia útil
 */
async function resolveWorkCalendar(
  organizationId: Types.ObjectId,
  guildId: string,
): Promise<Pick<WorkCalendar, 'workWeek' | 'holidays'>> {
  const calendar = await WorkCalendarModel.findOne({
    organizationId,
    $or: [{ guildId }, { guildId: { $exists: false } }],
  })
    .sort({ guildId: -1 })
    .lean()
    .exec();

  if (!calendar) {
    return { workWeek: createDefaultWorkWeek(), holidays: [] };
  }

  return {
    workWeek: calendar.workWeek,
    holidays: calendar.holidays,
  };
}

/**
 * Gera o snapshot semanal de inatividade para organização e guild.
 * @param organizationId Identificador textual da organização
 * @param guildId Identificador da guild no Discord
 * @param referenceDate Data de referência para cálculo (default: agora)
 * @returns Snapshot persistido no banco para consumo de relatórios
 */
export async function generateWeeklyInactivitySnapshot(
  organizationId: string,
  guildId: string,
  referenceDate: Date = new Date(),
): Promise<{
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  entries: InactivitySnapshotEntry[];
}> {
  const organizationObjectId = parseObjectId(organizationId, 'organizationId');
  const periodEnd = startOfUtcDay(referenceDate);
  const periodStart = new Date(periodEnd.getTime() - 6 * 24 * 60 * 60 * 1000);

  const settingsDoc = await InactivitySettingsModel.findOne({
    organizationId: organizationObjectId,
    guildId,
  })
    .lean()
    .exec();
  const settings = normalizeThresholdSettings(settingsDoc ?? undefined);
  const calendar = await resolveWorkCalendar(organizationObjectId, guildId);

  const trackedUsers = await TrackedUserModel.find({
    organizationId: organizationObjectId,
    guildId,
  })
    .select({ _id: 1, discordId: 1, displayName: 1, categoryId: 1, lastSeenAt: 1, lastTextActivityAt: 1 })
    .lean()
    .exec();

  const discordIds = trackedUsers.map((user) => user.discordId);
  const [lastTextByDiscordId, plannedAbsencesByDiscordId, categoryNamesById] = await Promise.all([
    getLastTextActivityByDiscordId(organizationObjectId, guildId, discordIds),
    getPlannedAbsencesByDiscordId(organizationObjectId, guildId, discordIds),
    getCategoryNamesById(organizationObjectId, guildId),
  ]);

  const entries: InactivitySnapshotEntry[] = trackedUsers.map((trackedUser) => {
    const absences = plannedAbsencesByDiscordId.get(trackedUser.discordId) ?? [];
    const lastPresenceAt = trackedUser.lastSeenAt;
    const lastTextActivityAt = lastTextByDiscordId.get(trackedUser.discordId) ?? trackedUser.lastTextActivityAt;
    const lastVoiceCollaborationAt = undefined;
    const latestSignalAt = [lastPresenceAt, lastTextActivityAt].filter((date): date is Date => Boolean(date)).reduce(
      (latest, current) => (current.getTime() > latest.getTime() ? current : latest),
      lastPresenceAt,
    );

    const businessDaysInactive = computeBusinessDaysBetween({
      calendar,
      from: latestSignalAt,
      to: referenceDate,
      isOnPlannedAbsenceAt: (date) => isOnPlannedAbsence(absences, date),
    });

    const zeroVoiceDays = computeBusinessDaysBetween({
      calendar,
      from: lastVoiceCollaborationAt ?? latestSignalAt,
      to: referenceDate,
      isOnPlannedAbsenceAt: (date) => isOnPlannedAbsence(absences, date),
    });

    const onPlannedAbsence = isOnPlannedAbsence(absences, referenceDate);
    const hasRecentText = Boolean(lastTextActivityAt) && businessDaysInactive === 0;
    const hasRecentPresence = businessDaysInactive === 0;
    const status = computeInactivityStatus({
      settings,
      businessDaysInactive,
      onPlannedAbsence,
      hasRecentText,
      hasRecentPresence,
      zeroVoiceDays,
    });

    const activeAbsence = absences.find((absence) => isOnPlannedAbsence([absence], referenceDate));
    const categoryId = trackedUser.categoryId as Types.ObjectId | undefined;

    return {
      trackedUserId: trackedUser._id as Types.ObjectId,
      discordId: trackedUser.discordId,
      displayName: trackedUser.displayName,
      categoryId,
      categoryName: categoryId ? categoryNamesById.get(String(categoryId)) : undefined,
      lastSeenAt: trackedUser.lastSeenAt,
      lastVoiceCollaborationAt,
      lastTextActivityAt,
      lastPresenceAt,
      inactiveBusinessDays: businessDaysInactive,
      status,
      plannedAbsence: activeAbsence
        ? {
            type: activeAbsence.type,
            endDate: activeAbsence.endDate,
          }
        : undefined,
    };
  });

  await InactivitySnapshotModel.findOneAndUpdate(
    { organizationId: organizationObjectId, guildId, periodStart },
    {
      $set: {
        periodEnd,
        entries,
        generatedAt: referenceDate,
      },
      $setOnInsert: {
        organizationId: organizationObjectId,
        guildId,
        periodStart,
      },
    },
    { upsert: true, new: true },
  );

  return { periodStart, periodEnd, generatedAt: referenceDate, entries };
}

/**
 * Retorna relatório semanal "quem sumiu" com filtro opcional de categoria.
 * @param organizationId Identificador textual da organização
 * @param guildId Identificador da guild no Discord
 * @param filters Filtros opcionais para o relatório
 * @param referenceDate Data de referência para geração/consulta do snapshot
 * @returns Estrutura pronta para endpoint de relatório semanal
 */
export async function getWeeklyInactivityReport(
  organizationId: string,
  guildId: string,
  filters: InactivityReportFilters = {},
  referenceDate: Date = new Date(),
): Promise<InactivityWeeklyReport> {
  const organizationObjectId = parseObjectId(organizationId, 'organizationId');
  const periodEnd = startOfUtcDay(referenceDate);
  const periodStart = new Date(periodEnd.getTime() - 6 * 24 * 60 * 60 * 1000);

  const snapshot = await InactivitySnapshotModel.findOne({
    organizationId: organizationObjectId,
    guildId,
    periodStart,
  })
    .lean()
    .exec();

  const freshSnapshot = snapshot ?? (await generateWeeklyInactivitySnapshot(organizationId, guildId, referenceDate));
  const allEntries = freshSnapshot.entries;
  const plannedAbsenceEntries = allEntries.filter((entry) => entry.status === 'on_planned_absence');
  const baseEntries = allEntries.filter((entry) => entry.status !== 'on_planned_absence');

  let entries = baseEntries;
  let absences = plannedAbsenceEntries;

  if (filters.categoryId) {
    const categoryObjectId = parseObjectId(filters.categoryId, 'categoryId');
    const matchCategory = (entry: InactivitySnapshotEntry): boolean =>
      Boolean(entry.categoryId) && String(entry.categoryId) === String(categoryObjectId);
    entries = entries.filter(matchCategory);
    absences = absences.filter(matchCategory);
  }

  return {
    periodStart,
    periodEnd,
    generatedAt: freshSnapshot.generatedAt,
    entries,
    plannedAbsenceEntries: absences,
  };
}

/**
 * Lista guilds que possuem membros rastreados para uma organização.
 * @param organizationId Identificador textual da organização
 * @returns IDs de guild válidas para execução do cron de inatividade
 */
export async function listTrackedGuildIdsByOrganization(organizationId: string): Promise<string[]> {
  const organizationObjectId = parseObjectId(organizationId, 'organizationId');
  const guildIds = await TrackedUserModel.distinct('guildId', { organizationId: organizationObjectId } as FilterQuery<typeof TrackedUserModel>);
  return guildIds.filter((guildId): guildId is string => typeof guildId === 'string' && guildId.length > 0);
}
