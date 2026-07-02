import { Types } from 'mongoose';
import { User } from '../db/models/User';
import { TrackedUserModel } from '../db/models/TrackedUser';
import { dailyReportRepository } from '../repositories/dailyReportRepository';
import { voiceChannelTransitionRepository } from '../repositories/voiceChannelTransitionRepository';
import { voiceSessionRepository } from '../repositories/voiceSessionRepository';
import { secondsToHours } from './channelClassifier';
import { getWorkCalendarForGuild } from './workCalendarService';
import { formatDateString, getDayBounds, getZonedParts, zonedDateTimeToUtc } from '../utils/timezone';

/** Horas comerciais exibidas no heatmap do dashboard. */
export const DASHBOARD_HEATMAP_WORK_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17] as const;

/** Quantidade de dias civis retornados no overview. */
export const DASHBOARD_OVERVIEW_DAYS = 7;

/** Ponto diário de colaboração agregada do time. */
export interface DashboardOverviewDailyPoint {
  /** Data civil YYYY-MM-DD na timezone da organização */
  date: string;
  /** Horas colaborativas (DailyReport.productiveSeconds → horas) */
  collaborationHours: number;
  /** Horas totais em voz */
  voiceHours: number;
}

/** Célula do heatmap de colaboração por dia da semana e hora. */
export interface DashboardOverviewHeatmapCell {
  /** 0=segunda … 6=domingo */
  dayIndex: number;
  /** Hora comercial local (8–17) */
  hour: number;
  /** Quantidade de eventos colaborativos no período */
  eventCount: number;
}

/** Snapshot histórico do dashboard para gráfico semanal e heatmap. */
export interface DashboardOverview {
  generatedAt: string;
  timezone: string;
  periodStart: string;
  periodEnd: string;
  trackedMembersCount: number;
  dailyCollaboration: DashboardOverviewDailyPoint[];
  weeklyAverageHours: number;
  heatmap: DashboardOverviewHeatmapCell[];
}

/** Janela civil de um dia para agregação multitenant. */
interface DashboardOverviewDayWindow {
  date: string;
  dayStart: Date;
  dayEnd: Date;
  windowEnd: Date;
}

/**
 * Retorna overview histórico de colaboração do guild (7 dias + heatmap horário).
 * Combina DailyReport dos membros rastreados com fallback de VoiceSession quando o relatório diário ainda não foi gerado.
 * @param organizationId ID da organização tenant
 * @param guildId ID do servidor Discord monitorado
 * @param now Instante de referência (default: agora)
 * @returns Série diária, média semanal e heatmap por dia/hora
 */
export async function getGuildDashboardOverview(
  organizationId: string,
  guildId: string,
  now: Date = new Date(),
): Promise<DashboardOverview> {
  const organizationObjectId = new Types.ObjectId(organizationId);
  const calendar = await getWorkCalendarForGuild(organizationId, guildId);
  const timezone = calendar.timezone;

  const [trackedUsers, coreUserIds] = await Promise.all([
    TrackedUserModel.find({ organizationId: organizationObjectId, guildId, isActive: true })
      .select('_id discordId')
      .lean<Array<{ _id: unknown; discordId: string }>>(),
    resolveCoreUserIdsForGuild(organizationId, guildId),
  ]);

  const dayWindows = buildOverviewDayWindows(timezone, now);
  const rangeStart = dayWindows[0]?.dayStart ?? getDayBounds(now, timezone).start;
  const rangeEnd = dayWindows[dayWindows.length - 1]?.dayEnd ?? getDayBounds(now, timezone).end;

  const [dailyReportRows, collaborationTransitions] = await Promise.all([
    dailyReportRepository.aggregateByUserIdsForDateRange(coreUserIds, rangeStart, rangeEnd),
    voiceChannelTransitionRepository.findCollaborationSinceByGuild(organizationId, guildId, rangeStart),
  ]);

  const dailyReportByDate = new Map(
    dailyReportRows.map((row) => [formatDateString(row.date, timezone), row]),
  );

  const dailyCollaboration: DashboardOverviewDailyPoint[] = [];
  for (const window of dayWindows) {
    const reportRow = dailyReportByDate.get(window.date);
    if (reportRow && reportRow.productiveSeconds > 0) {
      dailyCollaboration.push({
        date: window.date,
        collaborationHours: secondsToHours(reportRow.productiveSeconds),
        voiceHours: secondsToHours(reportRow.voiceSeconds),
      });
      continue;
    }

    const voiceTotals = await voiceSessionRepository.sumTodayByUserIds(
      coreUserIds,
      organizationObjectId,
      guildId,
      window.dayStart,
      window.windowEnd,
    );

    let collaborationSeconds = 0;
    let inactiveSeconds = 0;
    for (const totals of voiceTotals.values()) {
      collaborationSeconds += totals.collaborationSeconds;
      inactiveSeconds += totals.inactiveSeconds;
    }

    dailyCollaboration.push({
      date: window.date,
      collaborationHours: secondsToHours(collaborationSeconds),
      voiceHours: secondsToHours(collaborationSeconds + inactiveSeconds),
    });
  }

  const totalHours = dailyCollaboration.reduce((sum, point) => sum + point.collaborationHours, 0);
  const weeklyAverageHours = Number((totalHours / DASHBOARD_OVERVIEW_DAYS).toFixed(1));

  return {
    generatedAt: now.toISOString(),
    timezone,
    periodStart: dayWindows[0]?.date ?? formatDateString(now, timezone),
    periodEnd: dayWindows[dayWindows.length - 1]?.date ?? formatDateString(now, timezone),
    trackedMembersCount: trackedUsers.length,
    dailyCollaboration,
    weeklyAverageHours,
    heatmap: buildOverviewHeatmap(collaborationTransitions, timezone),
  };
}

/**
 * Resolve IDs core (`User`) dos membros rastreados ativos do guild.
 * @param organizationId ID da organização
 * @param guildId ID do servidor Discord
 * @returns IDs Mongo de usuários core com sessões agregáveis
 */
async function resolveCoreUserIdsForGuild(organizationId: string, guildId: string): Promise<Types.ObjectId[]> {
  const organizationObjectId = new Types.ObjectId(organizationId);
  const tracked = await TrackedUserModel.find({ organizationId: organizationObjectId, guildId, isActive: true })
    .select('discordId')
    .lean<Array<{ discordId: string }>>();

  if (tracked.length === 0) {
    return [];
  }

  const discordIds = tracked.map((member) => member.discordId);
  const users = await User.find({ discordId: { $in: discordIds } })
    .select('_id')
    .lean<Array<{ _id: Types.ObjectId }>>();

  return users.map((user) => user._id);
}

/**
 * Monta janelas civis dos últimos N dias na timezone informada.
 * @param timezone Timezone IANA da organização
 * @param now Instante de referência
 * @returns Lista ordenada do mais antigo ao dia atual
 */
function buildOverviewDayWindows(timezone: string, now: Date): DashboardOverviewDayWindow[] {
  const todayParts = getZonedParts(now, timezone);
  const windows: DashboardOverviewDayWindow[] = [];

  for (let offset = DASHBOARD_OVERVIEW_DAYS - 1; offset >= 0; offset -= 1) {
    const dayStart = zonedDateTimeToUtc(
      todayParts.year,
      todayParts.month,
      todayParts.day - offset,
      0,
      0,
      0,
      timezone,
    );
    const { end: dayEnd } = getDayBounds(dayStart, timezone);
    const date = formatDateString(dayStart, timezone);
    const isToday = offset === 0;

    windows.push({
      date,
      dayStart,
      dayEnd,
      windowEnd: isToday ? now : dayEnd,
    });
  }

  return windows;
}

/**
 * Agrega transições colaborativas em células de heatmap (dia da semana × hora).
 * @param transitions Eventos colaborativos do período
 * @param timezone Timezone IANA para bucketing
 * @returns Grade completa 7×10 com contagem zero onde não houve eventos
 */
function buildOverviewHeatmap(
  transitions: Array<{ occurredAt: Date }>,
  timezone: string,
): DashboardOverviewHeatmapCell[] {
  const counts = new Map<string, number>();

  for (const transition of transitions) {
    const parts = getZonedParts(transition.occurredAt, timezone);
    if (!DASHBOARD_HEATMAP_WORK_HOURS.includes(parts.hour as (typeof DASHBOARD_HEATMAP_WORK_HOURS)[number])) {
      continue;
    }

    const dayIndex = mapWeekdayToMondayIndex(transition.occurredAt, timezone);
    const key = `${dayIndex}:${parts.hour}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const cells: DashboardOverviewHeatmapCell[] = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    for (const hour of DASHBOARD_HEATMAP_WORK_HOURS) {
      cells.push({
        dayIndex,
        hour,
        eventCount: counts.get(`${dayIndex}:${hour}`) ?? 0,
      });
    }
  }

  return cells;
}

/**
 * Converte instante para índice 0=segunda … 6=domingo na timezone informada.
 * @param date Instante UTC
 * @param timezone Timezone IANA
 * @returns Índice compatível com rótulos Seg–Dom do frontend
 */
function mapWeekdayToMondayIndex(date: Date, timezone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(date);

  const mapping: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };

  return mapping[weekday] ?? 0;
}
