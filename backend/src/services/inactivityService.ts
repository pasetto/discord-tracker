import { FilterQuery, Types } from 'mongoose';
import { InactivitySettingsModel, type IInactivitySettings } from '../db/models/InactivitySettings';
import {
  InactivitySnapshotModel,
  type InactivitySnapshotEntry,
  type InactivityStatus,
} from '../db/models/InactivitySnapshot';
import { MemberCategoryModel } from '../db/models/MemberCategory';
import { User } from '../db/models/User';
import { PlannedAbsenceModel, type IPlannedAbsence } from '../db/models/PlannedAbsence';
import { TextActivityEventModel } from '../db/models/TextActivityEvent';
import { TrackedUserModel } from '../db/models/TrackedUser';
import { WorkCalendarModel, createDefaultWorkWeek, type WorkCalendar } from '../db/models/WorkCalendar';
import { OrganizationModel } from '../db/models/Organization';
import { isOnPlannedAbsence } from './plannedAbsenceService';
import { isBusinessDay } from './workCalendarService';
import { voiceSessionRepository } from '../repositories/voiceSessionRepository';

/**
 * Configuração mínima necessária para cálculo de status de inatividade.
 */
export interface InactivityThresholdSettings {
  inactiveAfterBusinessDays: number;
  zeroVoiceCollaborationDays: number;
  lateStartThresholdPercent: number;
  minCollaborationPercentOfElapsed: number;
  notifyManagerPush: boolean;
  notifyIntradayPush: boolean;
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
  /** Início do período exibido (opcional; default: fim - 6 dias) */
  from?: Date;
  /** Fim do período analisado (opcional; default: referenceDate) */
  to?: Date;
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
 * Contexto de acesso aplicado ao relatório semanal de inatividade.
 */
export interface InactivityWeeklyAccessContext {
  requesterRole?: 'owner' | 'admin' | 'manager' | 'viewer';
}

/**
 * Ponto da timeline de inatividade de um colaborador.
 */
export interface InactivityHistoryPoint {
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  status: InactivityStatus;
  inactiveBusinessDays: number;
}

/**
 * Histórico semanal de status de inatividade por membro rastreado.
 */
export interface InactivityMemberHistory {
  trackedUserId: Types.ObjectId;
  discordId: string;
  displayName: string;
  timeline: InactivityHistoryPoint[];
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
 * Retorna a data mais recente entre candidatos válidos.
 * @param dates Datas opcionais (undefined/null são ignorados)
 * @returns Maior instante encontrado, ou undefined quando não há candidatos
 * @example
 * resolveLatestDate(new Date('2026-01-01'), undefined, new Date('2026-01-03'))
 */
export function resolveLatestDate(...dates: Array<Date | undefined | null>): Date | undefined {
  const valid = dates.filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()));
  if (valid.length === 0) {
    return undefined;
  }

  return valid.reduce((latest, current) => (current.getTime() > latest.getTime() ? current : latest));
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
    lateStartThresholdPercent: settings?.lateStartThresholdPercent ?? 30,
    minCollaborationPercentOfElapsed: settings?.minCollaborationPercentOfElapsed ?? 20,
    notifyManagerPush: settings?.notifyManagerPush ?? true,
    notifyIntradayPush: settings?.notifyIntradayPush ?? true,
    notifyManagerEmail: settings?.notifyManagerEmail ?? false,
  };
}

/**
 * Normaliza configuração de inatividade com defaults seguros (sem breaking change).
 * @param settings Documento opcional persistido no banco
 * @returns Configuração pronta para cálculo semanal e intradiário
 */
export function getInactivityThresholdSettings(
  settings?: Pick<IInactivitySettings, keyof InactivityThresholdSettings>,
): InactivityThresholdSettings {
  return normalizeThresholdSettings(settings);
}

/**
 * Determina o status final de inatividade de um membro.
 * @param input Métricas de sinais e limiares da organização
 * @returns Status calculado para o relatório
 * @example
 * computeInactivityStatus({
 *   settings: {
 *     inactiveAfterBusinessDays: 2,
 *     zeroVoiceCollaborationDays: 3,
 *     notifyManagerPush: true,
 *     notifyIntradayPush: true,
 *     notifyManagerEmail: false,
 *   },
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
 * Marca membro como `returned` quando estava `missing` na semana anterior e voltou.
 * @param currentStatus Status calculado para a semana atual
 * @param previousStatus Status persistido na semana anterior, se existir
 * @returns Status final considerando retorno recente
 * @example
 * applyReturnedStatus('active', 'missing') // 'returned'
 */
export function applyReturnedStatus(
  currentStatus: InactivityStatus,
  previousStatus: InactivityStatus | undefined,
): InactivityStatus {
  if (
    previousStatus === 'missing'
    && (currentStatus === 'active' || currentStatus === 'low_voice_collaboration')
  ) {
    return 'returned';
  }

  return currentStatus;
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
 * Verifica se o relatório semanal deve ocultar PII para `viewer`.
 * @param organizationId Organização do tenant
 * @param requesterRole Papel de acesso do solicitante
 * @returns `true` quando deve redigir `displayName` e `discordId`
 */
async function shouldRedactViewerIndividualData(
  organizationId: Types.ObjectId,
  requesterRole: InactivityWeeklyAccessContext['requesterRole'],
): Promise<boolean> {
  if (requesterRole !== 'viewer') {
    return false;
  }

  const organization = await OrganizationModel.findById(organizationId)
    .select({ 'settings.viewerCanSeeIndividualReports': 1 })
    .lean()
    .exec();

  return !Boolean(organization?.settings?.viewerCanSeeIndividualReports);
}

/**
 * Remove PII de entradas individuais preservando métricas e status.
 * @param entries Entradas originais do snapshot
 * @returns Entradas com `displayName`/`discordId` anonimizados
 */
function redactWeeklyEntries(entries: InactivitySnapshotEntry[]): InactivitySnapshotEntry[] {
  return entries.map((entry) => ({
    ...entry,
    displayName: 'Colaborador oculto',
    discordId: 'redacted',
  }));
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
    isActive: true,
  })
    .select({ _id: 1, discordId: 1, displayName: 1, categoryId: 1, lastSeenAt: 1, lastTextActivityAt: 1 })
    .lean()
    .exec();

  const discordIds = trackedUsers.map((user) => user.discordId);
  const coreUsers = await User.find({ discordId: { $in: discordIds } })
    .select({ _id: 1, discordId: 1 })
    .lean()
    .exec();
  const coreUserIdByDiscordId = new Map(coreUsers.map((user) => [user.discordId, user._id as Types.ObjectId]));
  const coreUserIds = coreUsers.map((user) => user._id as Types.ObjectId);

  const [lastTextByDiscordId, plannedAbsencesByDiscordId, categoryNamesById, lastVoiceByUserId, previousSnapshot] =
    await Promise.all([
    getLastTextActivityByDiscordId(organizationObjectId, guildId, discordIds),
    getPlannedAbsencesByDiscordId(organizationObjectId, guildId, discordIds),
    getCategoryNamesById(organizationObjectId, guildId),
    voiceSessionRepository.getLastCollaborationAtByUserIds(coreUserIds, organizationObjectId, guildId),
    InactivitySnapshotModel.findOne({
      organizationId: organizationObjectId,
      guildId,
      periodStart: new Date(periodStart.getTime() - 7 * 24 * 60 * 60 * 1000),
    })
      .lean()
      .exec(),
  ]);

  const previousStatusByTrackedUserId = new Map(
    (previousSnapshot?.entries ?? []).map((entry) => [String(entry.trackedUserId), entry.status]),
  );

  const entries: InactivitySnapshotEntry[] = trackedUsers.map((trackedUser) => {
    const absences = plannedAbsencesByDiscordId.get(trackedUser.discordId) ?? [];
    const lastPresenceAt = trackedUser.lastSeenAt;
    const lastTextActivityAt = lastTextByDiscordId.get(trackedUser.discordId) ?? trackedUser.lastTextActivityAt;
    const coreUserId = coreUserIdByDiscordId.get(trackedUser.discordId);
    const lastVoiceCollaborationAt = coreUserId
      ? lastVoiceByUserId.get(String(coreUserId))
      : undefined;
    // Evita reduce com initial undefined (TypeError) quando só há texto ou nenhum sinal.
    const latestSignalAt = resolveLatestDate(lastPresenceAt, lastTextActivityAt) ?? periodStart;

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
    const baseStatus = computeInactivityStatus({
      settings,
      businessDaysInactive,
      onPlannedAbsence,
      hasRecentText,
      hasRecentPresence,
      zeroVoiceDays,
    });
    const status = applyReturnedStatus(
      baseStatus,
      previousStatusByTrackedUserId.get(String(trackedUser._id)),
    );

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
 * @param accessContext Contexto de papel para aplicar política de visibilidade
 * @returns Estrutura pronta para endpoint de relatório semanal
 */
export async function getWeeklyInactivityReport(
  organizationId: string,
  guildId: string,
  filters: InactivityReportFilters = {},
  referenceDate: Date = new Date(),
  accessContext: InactivityWeeklyAccessContext = {},
): Promise<InactivityWeeklyReport> {
  const organizationObjectId = parseObjectId(organizationId, 'organizationId');

  let periodStart: Date;
  let periodEnd: Date;
  let analysisReferenceDate: Date;

  if (filters.from && filters.to) {
    periodStart = startOfUtcDay(filters.from);
    periodEnd = startOfUtcDay(filters.to);
    analysisReferenceDate = periodEnd;
  } else {
    periodEnd = startOfUtcDay(referenceDate);
    periodStart = new Date(periodEnd.getTime() - 6 * 24 * 60 * 60 * 1000);
    analysisReferenceDate = referenceDate;
  }

  const snapshotPeriodStart = new Date(startOfUtcDay(analysisReferenceDate).getTime() - 6 * 24 * 60 * 60 * 1000);

  const snapshot = await InactivitySnapshotModel.findOne({
    organizationId: organizationObjectId,
    guildId,
    periodStart: snapshotPeriodStart,
  })
    .lean()
    .exec();

  const freshSnapshot = snapshot
    ?? (await generateWeeklyInactivitySnapshot(organizationId, guildId, analysisReferenceDate));
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

  const shouldRedact = await shouldRedactViewerIndividualData(organizationObjectId, accessContext.requesterRole);

  return {
    periodStart,
    periodEnd,
    generatedAt: freshSnapshot.generatedAt,
    entries: shouldRedact ? redactWeeklyEntries(entries) : entries,
    plannedAbsenceEntries: shouldRedact ? redactWeeklyEntries(absences) : absences,
  };
}

/**
 * Lista guilds que possuem membros rastreados para uma organização.
 * @param organizationId Identificador textual da organização
 * @returns IDs de guild válidas para execução do cron de inatividade
 */
export async function listTrackedGuildIdsByOrganization(organizationId: string): Promise<string[]> {
  const organizationObjectId = parseObjectId(organizationId, 'organizationId');
  const guildIds = await TrackedUserModel.distinct('guildId', {
    organizationId: organizationObjectId,
    isActive: true,
  } as FilterQuery<typeof TrackedUserModel>);
  return guildIds.filter((guildId): guildId is string => typeof guildId === 'string' && guildId.length > 0);
}

/**
 * Retorna timeline de snapshots semanais para um membro rastreado.
 * @param organizationId Identificador textual da organização
 * @param guildId Identificador da guild no Discord
 * @param trackedUserId Identificador do membro rastreado
 * @param limit Quantidade máxima de semanas no histórico (default 12)
 * @returns Histórico ordenado da semana mais recente para a mais antiga
 * @throws {Error} Quando trackedUserId é inválido ou membro não pertence à guild
 */
export async function getInactivityHistory(
  organizationId: string,
  guildId: string,
  trackedUserId: string,
  limit = 12,
): Promise<InactivityMemberHistory> {
  const organizationObjectId = parseObjectId(organizationId, 'organizationId');
  const trackedUserObjectId = parseObjectId(trackedUserId, 'trackedUserId');

  const trackedUser = await TrackedUserModel.findOne({
    _id: trackedUserObjectId,
    organizationId: organizationObjectId,
    guildId,
  })
    .select({ _id: 1, discordId: 1, displayName: 1 })
    .lean()
    .exec();

  if (!trackedUser) {
    throw new Error('Membro rastreado não encontrado nesta guild');
  }

  const snapshots = await InactivitySnapshotModel.find({
    organizationId: organizationObjectId,
    guildId,
    'entries.trackedUserId': trackedUserObjectId,
  })
    .sort({ periodStart: -1 })
    .limit(Math.min(Math.max(limit, 1), 52))
    .lean()
    .exec();

  const timeline: InactivityHistoryPoint[] = [];
  for (const snapshot of snapshots) {
    const entry = snapshot.entries.find(
      (item) => String(item.trackedUserId) === String(trackedUserObjectId),
    );
    if (!entry) {
      continue;
    }

    timeline.push({
      periodStart: snapshot.periodStart,
      periodEnd: snapshot.periodEnd,
      generatedAt: snapshot.generatedAt,
      status: entry.status,
      inactiveBusinessDays: entry.inactiveBusinessDays,
    });
  }

  return {
    trackedUserId: trackedUser._id as Types.ObjectId,
    discordId: trackedUser.discordId,
    displayName: trackedUser.displayName,
    timeline,
  };
}
