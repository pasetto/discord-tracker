import { Types } from 'mongoose';
import { User } from '../db/models/User';
import { OrganizationModel } from '../db/models/Organization';
import { InactivitySettingsModel } from '../db/models/InactivitySettings';
import { TrackedUserModel } from '../db/models/TrackedUser';
import { TextActivityEventModel } from '../db/models/TextActivityEvent';
import {
  PlannedAbsenceModel,
  type IPlannedAbsence,
  type PlannedAbsenceType,
} from '../db/models/PlannedAbsence';
import { WorkCalendarModel, createDefaultWorkWeek, type WorkCalendar } from '../db/models/WorkCalendar';
import { voiceSessionRepository } from '../repositories/voiceSessionRepository';
import { presenceSessionRepository } from '../repositories/presenceSessionRepository';
import { type PlannedAbsenceInterval } from './plannedAbsenceService';
import { getElapsedWorkWindowMetrics } from '../utils/workWindowUtils';
import { overlapSeconds } from '../utils/sessionTimeUtils';
import { getInactivityThresholdSettings, type InactivityThresholdSettings } from './inactivityService';

/** Status intradiário de um colaborador monitorado. */
export type IntradayInactivityStatus =
  | 'not_started'
  | 'low_collaboration_today'
  | 'on_planned_absence'
  | 'outside_work_day'
  | 'outside_work_hours'
  | 'ok';

/**
 * Referência mínima de ausência planejada para explicabilidade na UI.
 */
export interface IntradayPlannedAbsenceRef {
  type: PlannedAbsenceType;
  startDate: Date;
  endDate: Date;
}

/**
 * Ausência com tipo, usada para montar o DTO de explicabilidade.
 */
export type PlannedAbsenceWithType = PlannedAbsenceInterval & {
  type: PlannedAbsenceType;
};

/** Entrada do relatório intradiário "quem sumiu hoje". */
export interface IntradayInactivityEntry {
  trackedUserId: Types.ObjectId;
  discordId: string;
  displayName: string;
  categoryId?: Types.ObjectId;
  categoryName?: string;
  status: IntradayInactivityStatus;
  elapsedWorkPercent: number;
  collaborationPercentOfElapsed: number;
  collaborationSecondsInWorkWindow: number;
  elapsedWorkSeconds: number;
  hasAppearedToday: boolean;
  /** Presente quando status é on_planned_absence (tipo + janela). */
  plannedAbsence?: IntradayPlannedAbsenceRef;
}

/** Relatório intradiário completo para dashboard e API. */
export interface IntradayInactivityReport {
  generatedAt: Date;
  timezone: string;
  elapsedWorkPercent: number;
  elapsedWorkSeconds: number;
  totalWorkSeconds: number;
  isBusinessDay: boolean;
  isWithinWorkHours: boolean;
  settings: Pick<
    InactivityThresholdSettings,
    'lateStartThresholdPercent' | 'minCollaborationPercentOfElapsed'
  >;
  concernEntries: IntradayInactivityEntry[];
  allEntries: IntradayInactivityEntry[];
}

/**
 * Configuração mínima para cálculo intradiário.
 */
export interface IntradayThresholdSettings {
  lateStartThresholdPercent: number;
  minCollaborationPercentOfElapsed: number;
}

/**
 * Entrada para classificação intradiária pura (sem I/O).
 */
export interface ComputeIntradayInactivityInput {
  settings: IntradayThresholdSettings;
  onPlannedAbsence: boolean;
  isBusinessDay: boolean;
  elapsedPercent: number;
  elapsedWorkSeconds: number;
  hasAppearedToday: boolean;
  collaborationSecondsInWorkWindow: number;
}

/**
 * Classifica status intradiário de um colaborador com base em jornada e sinais do dia.
 * @param input Métricas do dia e limiares configurados
 * @returns Status intradiário calculado
 * @example
 * computeIntradayInactivityStatus({
 *   settings: { lateStartThresholdPercent: 30, minCollaborationPercentOfElapsed: 20 },
 *   onPlannedAbsence: false,
 *   isBusinessDay: true,
 *   elapsedPercent: 40,
 *   elapsedWorkSeconds: 3600,
 *   hasAppearedToday: false,
 *   collaborationSecondsInWorkWindow: 0,
 * }) // 'not_started'
 */
export function computeIntradayInactivityStatus(input: ComputeIntradayInactivityInput): IntradayInactivityStatus {
  if (input.onPlannedAbsence) {
    return 'on_planned_absence';
  }

  if (!input.isBusinessDay) {
    return 'outside_work_day';
  }

  if (input.elapsedPercent < input.settings.lateStartThresholdPercent) {
    return 'outside_work_hours';
  }

  if (!input.hasAppearedToday) {
    return 'not_started';
  }

  if (input.elapsedWorkSeconds <= 0) {
    return 'ok';
  }

  const collaborationPercent = (input.collaborationSecondsInWorkWindow / input.elapsedWorkSeconds) * 100;
  if (collaborationPercent < input.settings.minCollaborationPercentOfElapsed) {
    return 'low_collaboration_today';
  }

  return 'ok';
}

/**
 * Resolve a ausência ativa/agendada que cobre a data, com tipo e janela para a UI.
 * @param absences Ausências do colaborador (com tipo)
 * @param date Instante avaliado
 * @returns Referência mínima da ausência cobrindo a data, ou undefined
 * @example
 * resolveActivePlannedAbsenceRef(
 *   [{ type: 'pto', status: 'active', startDate: new Date('2026-07-10'), endDate: new Date('2026-07-20') }],
 *   new Date('2026-07-15'),
 * )
 */
export function resolveActivePlannedAbsenceRef(
  absences: PlannedAbsenceWithType[],
  date: Date,
): IntradayPlannedAbsenceRef | undefined {
  const target = date.getTime();
  const match = absences.find((absence) => {
    if (absence.status !== 'active' && absence.status !== 'scheduled') {
      return false;
    }
    return absence.startDate.getTime() <= target && target <= absence.endDate.getTime();
  });

  if (!match) {
    return undefined;
  }

  return {
    type: match.type,
    startDate: match.startDate,
    endDate: match.endDate,
  };
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
 * Resolve timezone efetiva da organização.
 * @param organizationId ID textual da organização
 * @returns Timezone IANA
 */
async function resolveOrganizationTimezone(organizationId: Types.ObjectId): Promise<string> {
  const organization = await OrganizationModel.findById(organizationId)
    .select({ 'settings.timezone': 1 })
    .lean()
    .exec();

  return organization?.settings?.timezone ?? 'America/Sao_Paulo';
}

/**
 * Resolve calendário de trabalho da organização/guild.
 * @param organizationId Organização tenant
 * @param guildId Guild monitorada
 * @returns Calendário com jornada e feriados
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

  return { workWeek: calendar.workWeek, holidays: calendar.holidays };
}

/**
 * Soma colaboração em voz dentro da janela de trabalho por userId core.
 * @param userIds IDs Mongo dos usuários core
 * @param organizationId Organização tenant
 * @param guildId Guild monitorada
 * @param windowStart Início da janela UTC
 * @param windowEnd Fim da janela UTC
 * @param now Instante atual
 * @returns Mapa userId → segundos de colaboração
 */
async function sumCollaborationInWorkWindowByUserIds(
  userIds: Types.ObjectId[],
  organizationId: Types.ObjectId,
  guildId: string,
  windowStart: Date,
  windowEnd: Date,
  now: Date,
): Promise<Map<string, number>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const effectiveEnd = now.getTime() < windowEnd.getTime() ? now : windowEnd;
  const sessions = await voiceSessionRepository.findOverlappingDay(
    userIds,
    organizationId,
    guildId,
    windowStart,
    effectiveEnd,
  );
  const totals = new Map<string, number>();

  for (const session of sessions) {
    if (session.isIgnoredChannel || session.sessionType !== 'VOICE') {
      continue;
    }

    const userKey = String(session.userId);
    const seconds = overlapSeconds(session.startedAt, session.endedAt, windowStart, effectiveEnd);
    totals.set(userKey, (totals.get(userKey) ?? 0) + seconds);
  }

  return totals;
}

/**
 * Indica se houve presença online dentro da janela de trabalho hoje.
 * @param userIds IDs Mongo dos usuários core
 * @param organizationId Organização tenant
 * @param guildId Guild monitorada
 * @param windowStart Início da janela UTC
 * @param now Instante atual
 * @returns Mapa userId → teve presença ativa
 */
async function hasPresenceInWorkWindowByUserIds(
  userIds: Types.ObjectId[],
  organizationId: Types.ObjectId,
  guildId: string,
  windowStart: Date,
  now: Date,
): Promise<Map<string, boolean>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const onlineTotals = await presenceSessionRepository.sumTodayOnlineByUserIds(
    userIds,
    organizationId,
    guildId,
    windowStart,
    now,
  );
  const result = new Map<string, boolean>();
  for (const [userId, seconds] of onlineTotals.entries()) {
    result.set(userId, seconds > 0);
  }
  return result;
}

/**
 * Resolve atividade textual dentro da jornada por discordId.
 * @param organizationId Organização tenant
 * @param guildId Guild monitorada
 * @param discordIds Usuários rastreados
 * @param windowStart Início da janela UTC
 * @param now Instante atual
 * @returns Mapa discordId → teve texto colaborativo
 */
async function hasTextInWorkWindowByDiscordId(
  organizationId: Types.ObjectId,
  guildId: string,
  discordIds: string[],
  windowStart: Date,
  now: Date,
): Promise<Map<string, boolean>> {
  if (discordIds.length === 0) {
    return new Map();
  }

  const rows = await TextActivityEventModel.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        organizationId,
        guildId,
        discordId: { $in: discordIds },
        occurredAt: { $gte: windowStart, $lte: now },
      },
    },
    { $group: { _id: '$discordId', count: { $sum: 1 } } },
  ]);

  return new Map(rows.map((row) => [row._id, row.count > 0]));
}

/**
 * Resolve ausências planejadas por discordId.
 * @param organizationId Organização tenant
 * @param guildId Guild monitorada
 * @param discordIds Usuários rastreados
 * @returns Mapa discordId → ausências ativas/agendadas
 */
async function getPlannedAbsencesByDiscordId(
  organizationId: Types.ObjectId,
  guildId: string,
  discordIds: string[],
): Promise<Map<string, IPlannedAbsence[]>> {
  if (discordIds.length === 0) {
    return new Map();
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
 * Gera relatório intradiário "quem sumiu hoje" para dashboard e API.
 * @param organizationId Identificador textual da organização
 * @param guildId Identificador da guild no Discord
 * @param referenceDate Instante de referência (default: agora)
 * @returns Relatório com entradas de alerta e contexto da jornada
 */
export async function getIntradayInactivityReport(
  organizationId: string,
  guildId: string,
  referenceDate: Date = new Date(),
): Promise<IntradayInactivityReport> {
  const organizationObjectId = parseObjectId(organizationId, 'organizationId');
  const [timezone, calendar, settingsDoc, trackedUsers] = await Promise.all([
    resolveOrganizationTimezone(organizationObjectId),
    resolveWorkCalendar(organizationObjectId, guildId),
    InactivitySettingsModel.findOne({ organizationId: organizationObjectId, guildId }).lean().exec(),
    TrackedUserModel.find({ organizationId: organizationObjectId, guildId, isActive: true })
      .select({ _id: 1, discordId: 1, displayName: 1, categoryId: 1, lastSeenAt: 1 })
      .lean()
      .exec(),
  ]);

  const settings = getInactivityThresholdSettings(settingsDoc ?? undefined);
  const workMetrics = getElapsedWorkWindowMetrics(calendar, referenceDate, timezone);

  if (trackedUsers.length === 0) {
    return {
      generatedAt: referenceDate,
      timezone,
      elapsedWorkPercent: workMetrics.elapsedPercent,
      elapsedWorkSeconds: workMetrics.elapsedWorkSeconds,
      totalWorkSeconds: workMetrics.totalWorkSeconds,
      isBusinessDay: workMetrics.isBusinessDay,
      isWithinWorkHours: workMetrics.isWithinWorkHours,
      settings: {
        lateStartThresholdPercent: settings.lateStartThresholdPercent,
        minCollaborationPercentOfElapsed: settings.minCollaborationPercentOfElapsed,
      },
      concernEntries: [],
      allEntries: [],
    };
  }

  const discordIds = trackedUsers.map((user) => user.discordId);
  const coreUsers = await User.find({ discordId: { $in: discordIds } })
    .select({ _id: 1, discordId: 1 })
    .lean()
    .exec();
  const coreUserIdByDiscordId = new Map(coreUsers.map((user) => [user.discordId, user._id as Types.ObjectId]));
  const coreUserIds = coreUsers.map((user) => user._id as Types.ObjectId);

  const windowStart = workMetrics.bounds?.workStartUtc ?? referenceDate;
  const windowEnd = workMetrics.bounds?.workEndUtc ?? referenceDate;

  const plannedAbsencesByDiscordId = await getPlannedAbsencesByDiscordId(
    organizationObjectId,
    guildId,
    discordIds,
  );

  const [collaborationByUserId, presenceByUserId, textByDiscordId] = await Promise.all([
    workMetrics.bounds
      ? sumCollaborationInWorkWindowByUserIds(coreUserIds, organizationObjectId, guildId, windowStart, windowEnd, referenceDate)
      : Promise.resolve(new Map<string, number>()),
    workMetrics.bounds
      ? hasPresenceInWorkWindowByUserIds(coreUserIds, organizationObjectId, guildId, windowStart, referenceDate)
      : Promise.resolve(new Map<string, boolean>()),
    workMetrics.bounds
      ? hasTextInWorkWindowByDiscordId(organizationObjectId, guildId, discordIds, windowStart, referenceDate)
      : Promise.resolve(new Map<string, boolean>()),
  ]);

  const allEntries: IntradayInactivityEntry[] = trackedUsers.map((trackedUser) => {
    const coreUserId = coreUserIdByDiscordId.get(trackedUser.discordId);
    const collaborationSeconds = coreUserId ? collaborationByUserId.get(String(coreUserId)) ?? 0 : 0;
    const hasPresence = coreUserId ? presenceByUserId.get(String(coreUserId)) ?? false : false;
    const hasText = textByDiscordId.get(trackedUser.discordId) ?? false;
    const hasSeenToday = Boolean(
      trackedUser.lastSeenAt
      && trackedUser.lastSeenAt.getTime() >= windowStart.getTime()
      && trackedUser.lastSeenAt.getTime() <= referenceDate.getTime(),
    );
    const hasAppearedToday = hasPresence || hasText || hasSeenToday || collaborationSeconds > 0;

    const absences = plannedAbsencesByDiscordId.get(trackedUser.discordId) ?? [];
    const plannedAbsence = resolveActivePlannedAbsenceRef(absences, referenceDate);
    const onPlannedAbsence = Boolean(plannedAbsence);

    const status = computeIntradayInactivityStatus({
      settings: {
        lateStartThresholdPercent: settings.lateStartThresholdPercent,
        minCollaborationPercentOfElapsed: settings.minCollaborationPercentOfElapsed,
      },
      onPlannedAbsence,
      isBusinessDay: workMetrics.isBusinessDay,
      elapsedPercent: workMetrics.elapsedPercent,
      elapsedWorkSeconds: workMetrics.elapsedWorkSeconds,
      hasAppearedToday,
      collaborationSecondsInWorkWindow: collaborationSeconds,
    });

    const collaborationPercentOfElapsed = workMetrics.elapsedWorkSeconds > 0
      ? Number(((collaborationSeconds / workMetrics.elapsedWorkSeconds) * 100).toFixed(2))
      : 0;

    return {
      trackedUserId: trackedUser._id as Types.ObjectId,
      discordId: trackedUser.discordId,
      displayName: trackedUser.displayName,
      categoryId: trackedUser.categoryId as Types.ObjectId | undefined,
      status,
      elapsedWorkPercent: workMetrics.elapsedPercent,
      collaborationPercentOfElapsed,
      collaborationSecondsInWorkWindow: collaborationSeconds,
      elapsedWorkSeconds: workMetrics.elapsedWorkSeconds,
      hasAppearedToday,
      plannedAbsence: status === 'on_planned_absence' ? plannedAbsence : undefined,
    };
  });

  const concernEntries = allEntries.filter(
    (entry) => entry.status === 'not_started' || entry.status === 'low_collaboration_today',
  );

  return {
    generatedAt: referenceDate,
    timezone,
    elapsedWorkPercent: workMetrics.elapsedPercent,
    elapsedWorkSeconds: workMetrics.elapsedWorkSeconds,
    totalWorkSeconds: workMetrics.totalWorkSeconds,
    isBusinessDay: workMetrics.isBusinessDay,
    isWithinWorkHours: workMetrics.isWithinWorkHours,
    settings: {
      lateStartThresholdPercent: settings.lateStartThresholdPercent,
      minCollaborationPercentOfElapsed: settings.minCollaborationPercentOfElapsed,
    },
    concernEntries,
    allEntries,
  };
}
