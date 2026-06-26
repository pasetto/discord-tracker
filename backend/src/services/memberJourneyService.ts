import { Types } from 'mongoose';
import { OrganizationModel } from '../db/models/Organization';
import { PresenceSession } from '../db/models/PresenceSession';
import { TrackedUserModel } from '../db/models/TrackedUser';
import { User } from '../db/models/User';
import { VoiceSession } from '../db/models/VoiceSession';
import {
  DEFAULT_TIMEZONE,
  formatDateString,
  getDayBounds,
  getZonedParts,
  zonedDateTimeToUtc,
} from '../utils/timezone';
import { endOfUtcDay, startOfUtcDay, startOfUtcWeek } from '../utils/sessionTimeUtils';

/** Minutos em um dia completo (00:00 → 24:00). */
const MINUTES_IN_DAY = 24 * 60;

/** Status de presença considerados como "colaborador ativo/online". */
const ONLINE_PRESENCE_STATUSES = ['ONLINE', 'IDLE', 'DND'] as const;

/** Rótulos curtos de dia da semana (0 = domingo) em pt-BR. */
const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const;

/** Sinal usado para determinar entrada/saída diária do colaborador. */
export type MemberJourneySignal = 'presence' | 'voice';

/**
 * Sessão genérica (presença ou voz) usada no cálculo de jornada.
 */
export interface JourneySessionInput {
  startedAt: Date;
  endedAt: Date | null;
  /** Nome do canal de voz (apenas sinal `voice`). */
  channelName?: string;
  /** Indica se o canal está marcado como ignorado nas regras da guild. */
  isIgnoredChannel?: boolean;
}

/**
 * Segmento individual de atividade em um dia civil (uma entrada em canal de voz).
 */
export interface MemberJourneySessionSegment {
  /** Minutos desde a meia-noite local da entrada neste segmento. */
  entryMinute: number;
  /** Minutos desde a meia-noite local da saída neste segmento. */
  exitMinute: number;
  /** Rótulo HH:MM da entrada. */
  entryLabel: string;
  /** Rótulo HH:MM da saída. */
  exitLabel: string;
  /** Nome do canal de voz. */
  channelName: string;
  /** Indica se o canal é ignorado nas regras de colaboração. */
  isIgnoredChannel: boolean;
  /** Duração do segmento em minutos. */
  spanMinutes: number;
}

/**
 * Jornada calculada para um único dia civil.
 */
export interface MemberJourneyDay {
  /** Data civil no formato YYYY-MM-DD na timezone da organização. */
  date: string;
  /** Dia da semana (0 = domingo … 6 = sábado). */
  weekday: number;
  /** Indica se houve qualquer atividade registrada no dia. */
  hasActivity: boolean;
  /** Minutos desde a meia-noite local do primeiro sinal (entrada). */
  entryMinute: number | null;
  /** Minutos desde a meia-noite local do último sinal (saída). */
  exitMinute: number | null;
  /** Rótulo HH:MM da entrada. */
  entryLabel: string | null;
  /** Rótulo HH:MM da saída. */
  exitLabel: string | null;
  /** Janela bruta entre entrada e saída em minutos. */
  spanMinutes: number;
  /**
   * Sessões individuais do dia (preenchido no sinal `voice`).
   * Cada item representa uma entrada em canal com início e fim no mesmo dia civil.
   */
  sessions: MemberJourneySessionSegment[];
}

/**
 * Padrão agregado por dia da semana para detecção de comportamento.
 */
export interface MemberJourneyWeekdayPattern {
  weekday: number;
  label: string;
  sampleDays: number;
  avgEntryMinute: number | null;
  avgExitMinute: number | null;
  avgEntryLabel: string | null;
  avgExitLabel: string | null;
  earliestEntryMinute: number | null;
  latestEntryMinute: number | null;
  /** Variabilidade da entrada (maior − menor) em minutos. */
  entrySpreadMinutes: number | null;
}

/**
 * Resumo geral da jornada do colaborador no período.
 */
export interface MemberJourneySummary {
  totalDays: number;
  daysWithActivity: number;
  avgEntryMinute: number | null;
  avgExitMinute: number | null;
  avgEntryLabel: string | null;
  avgExitLabel: string | null;
  avgSpanHours: number;
  /** Quantidade de entradas em canais de colaboração (somente sinal `voice`). */
  voiceEntryCount: number;
  /** Horários de entrada em colaboração no período, em ordem cronológica. */
  collaborationEntryLabels: string[];
  /** Total de minutos em canais de colaboração no período. */
  totalCollaborationMinutes: number;
  /** Média de horas de colaboração por dia com atividade. */
  avgDailyCollaborationHours: number;
}

/**
 * Relatório completo de padrões de jornada de um colaborador.
 */
export interface MemberJourneyReport {
  trackedUserId: string;
  discordId: string;
  displayName: string;
  timezone: string;
  signal: MemberJourneySignal;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  days: MemberJourneyDay[];
  weekdayPatterns: MemberJourneyWeekdayPattern[];
  summary: MemberJourneySummary;
}

/**
 * Entrada para geração do relatório de jornada por pessoa.
 */
export interface MemberJourneyReportInput {
  organizationId: string;
  guildId: string;
  trackedUserId: string;
  signal?: MemberJourneySignal;
  from?: Date;
  to?: Date;
  /** Instante atual (limita sessões abertas e o período ao presente). Default: agora. */
  now?: Date;
  /**
   * Inclui sessões em canais ignorados (somente sinal `voice`).
   * Default: `false` — apenas canais de colaboração.
   */
  includeIgnoredChannels?: boolean;
}

/**
 * Converte string para ObjectId válido.
 * @param value Valor textual recebido na rota
 * @param label Nome lógico do campo para mensagens de erro
 * @returns ObjectId pronto para consultas
 * @throws {Error} Quando identificador não for um ObjectId válido
 */
function parseObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} inválido`);
  }
  return new Types.ObjectId(value);
}

/**
 * Retorna minutos desde a meia-noite local de um instante na timezone.
 * @param instant Instante UTC
 * @param timezone Timezone IANA
 * @returns Minutos no intervalo [0, 1439]
 */
function zonedMinuteOfDay(instant: Date, timezone: string): number {
  const parts = getZonedParts(instant, timezone);
  return parts.hour * 60 + parts.minute;
}

/**
 * Formata minutos desde a meia-noite como rótulo HH:MM.
 * @param minutes Minutos no dia (pode ser 1440 para fim do dia)
 * @returns Texto no formato HH:MM
 * @example minutesToLabel(570) // '09:30'
 */
export function minutesToLabel(minutes: number): string {
  const clamped = Math.max(0, Math.min(MINUTES_IN_DAY, Math.round(minutes)));
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Lista as datas civis (YYYY-MM-DD) contidas no período, na timezone informada.
 * @param periodStart Início do período (UTC)
 * @param periodEnd Fim do período (UTC)
 * @param timezone Timezone IANA
 * @returns Lista ordenada de datas civis
 */
export function listCivilDays(periodStart: Date, periodEnd: Date, timezone: string): string[] {
  const days: string[] = [];
  const lastKey = formatDateString(periodEnd, timezone);
  let bounds = getDayBounds(periodStart, timezone);
  let safety = 0;

  while (safety < 400) {
    const key = formatDateString(bounds.start, timezone);
    days.push(key);
    if (key === lastKey) {
      break;
    }
    bounds = getDayBounds(bounds.end, timezone);
    safety += 1;
  }

  return days;
}

/**
 * Determina o dia da semana (0 = domingo) de uma data civil YYYY-MM-DD.
 * @param civilDate Data civil
 * @returns Índice do dia da semana
 */
export function weekdayOfCivilDate(civilDate: string): number {
  return new Date(`${civilDate}T12:00:00Z`).getUTCDay();
}

/**
 * Calcula entrada (primeiro sinal) e saída (último sinal) por dia civil.
 *
 * Sessões que cruzam a meia-noite são divididas por dia: o dia inicial recebe saída
 * até o fim do dia (24:00) e o dia seguinte recebe entrada a partir de 00:00.
 * @param sessions Sessões com início e fim (fim nulo = ainda aberta)
 * @param periodStart Início do período (UTC)
 * @param windowEnd Fim efetivo da janela (UTC, já limitado ao presente)
 * @param timezone Timezone IANA da organização
 * @returns Mapa data civil → { entry, exit } em minutos do dia
 */
export function computeDailyJourney(
  sessions: JourneySessionInput[],
  periodStart: Date,
  windowEnd: Date,
  timezone: string,
): Map<string, { entry: number; exit: number }> {
  const candidates = new Map<string, { entry: number; exit: number }>();

  const addCandidate = (key: string, entry: number, exit: number): void => {
    const current = candidates.get(key);
    if (!current) {
      candidates.set(key, { entry, exit });
      return;
    }
    current.entry = Math.min(current.entry, entry);
    current.exit = Math.max(current.exit, exit);
  };

  for (const session of sessions) {
    const startMs = Math.max(session.startedAt.getTime(), periodStart.getTime());
    const rawEndMs = session.endedAt ? session.endedAt.getTime() : windowEnd.getTime();
    const endMs = Math.min(rawEndMs, windowEnd.getTime());
    if (endMs <= startMs) {
      continue;
    }

    let bounds = getDayBounds(new Date(startMs), timezone);
    let safety = 0;

    while (bounds.start.getTime() < endMs && safety < 400) {
      const dayStartMs = bounds.start.getTime();
      const dayEndMs = bounds.end.getTime();
      const segStart = Math.max(startMs, dayStartMs);
      const segEnd = Math.min(endMs, dayEndMs);

      if (segEnd > segStart) {
        const key = formatDateString(bounds.start, timezone);
        const entry = segStart === dayStartMs ? 0 : zonedMinuteOfDay(new Date(segStart), timezone);
        const exit = segEnd === dayEndMs ? MINUTES_IN_DAY : zonedMinuteOfDay(new Date(segEnd), timezone);
        addCandidate(key, entry, exit);
      }

      bounds = getDayBounds(bounds.end, timezone);
      safety += 1;
    }
  }

  return candidates;
}

/**
 * Divide sessões em segmentos individuais por dia civil, sem agregar entrada/saída.
 *
 * Cada segmento corresponde a uma permanência contínua em canal (ou presença) dentro
 * de um único dia. Sessões que cruzam a meia-noite geram um segmento por dia civil.
 * @param sessions Sessões com início e fim (fim nulo = ainda aberta)
 * @param periodStart Início do período (UTC)
 * @param windowEnd Fim efetivo da janela (UTC, já limitado ao presente)
 * @param timezone Timezone IANA da organização
 * @returns Mapa data civil → lista de segmentos ordenados por entrada
 */
export function computeDailySessionSegments(
  sessions: JourneySessionInput[],
  periodStart: Date,
  windowEnd: Date,
  timezone: string,
): Map<string, MemberJourneySessionSegment[]> {
  const segmentsByDay = new Map<string, MemberJourneySessionSegment[]>();

  const appendSegment = (key: string, segment: MemberJourneySessionSegment): void => {
    const list = segmentsByDay.get(key) ?? [];
    list.push(segment);
    segmentsByDay.set(key, list);
  };

  for (const session of sessions) {
    const startMs = Math.max(session.startedAt.getTime(), periodStart.getTime());
    const rawEndMs = session.endedAt ? session.endedAt.getTime() : windowEnd.getTime();
    const endMs = Math.min(rawEndMs, windowEnd.getTime());
    if (endMs <= startMs) {
      continue;
    }

    let bounds = getDayBounds(new Date(startMs), timezone);
    let safety = 0;

    while (bounds.start.getTime() < endMs && safety < 400) {
      const dayStartMs = bounds.start.getTime();
      const dayEndMs = bounds.end.getTime();
      const segStart = Math.max(startMs, dayStartMs);
      const segEnd = Math.min(endMs, dayEndMs);

      if (segEnd > segStart) {
        const key = formatDateString(bounds.start, timezone);
        const entry = segStart === dayStartMs ? 0 : zonedMinuteOfDay(new Date(segStart), timezone);
        const exit = segEnd === dayEndMs ? MINUTES_IN_DAY : zonedMinuteOfDay(new Date(segEnd), timezone);
        appendSegment(key, {
          entryMinute: entry,
          exitMinute: exit,
          entryLabel: minutesToLabel(entry),
          exitLabel: minutesToLabel(exit),
          channelName: session.channelName ?? '',
          isIgnoredChannel: session.isIgnoredChannel ?? false,
          spanMinutes: Math.max(0, exit - entry),
        });
      }

      bounds = getDayBounds(bounds.end, timezone);
      safety += 1;
    }
  }

  for (const [key, list] of segmentsByDay.entries()) {
    list.sort((left, right) => left.entryMinute - right.entryMinute);
    segmentsByDay.set(key, list);
  }

  return segmentsByDay;
}

/**
 * Calcula a média inteira de uma lista de valores.
 * @param values Lista de números
 * @returns Média arredondada ou null quando vazia
 */
function averageMinutes(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round(sum / values.length);
}

/**
 * Agrega padrões por dia da semana a partir dos dias com atividade.
 * @param days Dias calculados da jornada
 * @returns Padrões por dia da semana (apenas dias com amostras)
 */
export function summarizeWeekdayPatterns(days: MemberJourneyDay[]): MemberJourneyWeekdayPattern[] {
  const byWeekday = new Map<number, { entries: number[]; exits: number[] }>();

  for (const day of days) {
    if (!day.hasActivity || day.entryMinute === null || day.exitMinute === null) {
      continue;
    }
    const bucket = byWeekday.get(day.weekday) ?? { entries: [], exits: [] };
    bucket.entries.push(day.entryMinute);
    bucket.exits.push(day.exitMinute);
    byWeekday.set(day.weekday, bucket);
  }

  const patterns: MemberJourneyWeekdayPattern[] = [];
  for (const [weekday, bucket] of byWeekday.entries()) {
    const avgEntry = averageMinutes(bucket.entries);
    const avgExit = averageMinutes(bucket.exits);
    const earliestEntry = bucket.entries.length > 0 ? Math.min(...bucket.entries) : null;
    const latestEntry = bucket.entries.length > 0 ? Math.max(...bucket.entries) : null;

    patterns.push({
      weekday,
      label: WEEKDAY_LABELS[weekday],
      sampleDays: bucket.entries.length,
      avgEntryMinute: avgEntry,
      avgExitMinute: avgExit,
      avgEntryLabel: avgEntry === null ? null : minutesToLabel(avgEntry),
      avgExitLabel: avgExit === null ? null : minutesToLabel(avgExit),
      earliestEntryMinute: earliestEntry,
      latestEntryMinute: latestEntry,
      entrySpreadMinutes: earliestEntry === null || latestEntry === null ? null : latestEntry - earliestEntry,
    });
  }

  return patterns.sort((left, right) => left.weekday - right.weekday);
}

/**
 * Resolve a janela bruta (UTC) do relatório a partir dos filtros.
 * @param input Filtros com from/to opcionais
 * @returns Início e fim brutos em UTC
 * @throws {Error} Quando from for posterior a to
 */
function resolveRawPeriod(input: MemberJourneyReportInput): { from: Date; to: Date } {
  const reference = input.to ?? input.now ?? new Date();
  if (input.from && input.to) {
    const from = startOfUtcDay(input.from);
    const to = endOfUtcDay(input.to);
    if (from.getTime() > to.getTime()) {
      throw new Error('Intervalo inválido: from deve ser anterior ou igual a to');
    }
    return { from, to };
  }

  return { from: startOfUtcWeek(reference), to: endOfUtcDay(reference) };
}

/**
 * Alinha o período às datas civis (na timezone) correspondentes ao intervalo selecionado.
 *
 * As datas selecionadas chegam como limites de dia em UTC; este passo as converte para
 * os limites do mesmo dia civil na timezone da organização, evitando "dias-fantasma"
 * causados pela diferença de fuso (ex.: 00:00 UTC = 21:00 do dia anterior em UTC-3).
 * @param from Início bruto (UTC)
 * @param to Fim bruto (UTC)
 * @param timezone Timezone IANA da organização
 * @returns Período alinhado às bordas de dia civil na timezone
 */
function snapPeriodToTimezone(from: Date, to: Date, timezone: string): { periodStart: Date; periodEnd: Date } {
  const periodStart = zonedDateTimeToUtc(
    from.getUTCFullYear(),
    from.getUTCMonth() + 1,
    from.getUTCDate(),
    0,
    0,
    0,
    timezone,
  );
  const toDayStart = zonedDateTimeToUtc(
    to.getUTCFullYear(),
    to.getUTCMonth() + 1,
    to.getUTCDate(),
    0,
    0,
    0,
    timezone,
  );
  const periodEnd = new Date(getDayBounds(toDayStart, timezone).end.getTime() - 1);
  return { periodStart, periodEnd };
}

/**
 * Resolve a timezone configurada para a organização.
 * @param organizationId ObjectId da organização
 * @returns Timezone IANA ou default da aplicação
 */
async function resolveOrganizationTimezone(organizationId: Types.ObjectId): Promise<string> {
  const organization = await OrganizationModel.findById(organizationId)
    .select({ 'settings.timezone': 1 })
    .lean()
    .exec();
  return organization?.settings?.timezone || DEFAULT_TIMEZONE;
}

/**
 * Busca sessões do colaborador conforme o sinal escolhido.
 * @param coreUserId ID Mongo do usuário core
 * @param organizationId ID Mongo da organização
 * @param guildId ID do servidor Discord
 * @param signal Sinal de jornada (presença ou voz)
 * @param periodStart Início do período
 * @param windowEnd Fim efetivo da janela
 * @param includeIgnoredChannels Inclui canais ignorados (somente voz)
 * @returns Lista de sessões normalizadas
 */
async function fetchJourneySessions(
  coreUserId: Types.ObjectId,
  organizationId: Types.ObjectId,
  guildId: string,
  signal: MemberJourneySignal,
  periodStart: Date,
  windowEnd: Date,
  includeIgnoredChannels: boolean,
): Promise<JourneySessionInput[]> {
  const timeFilter = {
    startedAt: { $lte: windowEnd },
    $or: [{ endedAt: null }, { endedAt: { $gte: periodStart } }],
  };

  if (signal === 'voice') {
    const voiceFilter: Record<string, unknown> = {
      organizationId,
      guildId,
      userId: coreUserId,
      sessionType: 'VOICE',
      ...timeFilter,
    };
    if (!includeIgnoredChannels) {
      voiceFilter.isIgnoredChannel = false;
    }

    const sessions = await VoiceSession.find(voiceFilter)
      .select({ startedAt: 1, endedAt: 1, channelName: 1, isIgnoredChannel: 1 })
      .lean()
      .exec();
    return sessions.map((session) => ({
      startedAt: session.startedAt,
      endedAt: session.endedAt ?? null,
      channelName: session.channelName,
      isIgnoredChannel: session.isIgnoredChannel,
    }));
  }

  const sessions = await PresenceSession.find({
    organizationId,
    guildId,
    userId: coreUserId,
    status: { $in: [...ONLINE_PRESENCE_STATUSES] },
    ...timeFilter,
  })
    .select({ startedAt: 1, endedAt: 1 })
    .lean()
    .exec();
  return sessions.map((session) => ({ startedAt: session.startedAt, endedAt: session.endedAt ?? null }));
}

/**
 * Gera o relatório de padrões de jornada (entrada/saída) de um colaborador.
 *
 * Para cada dia civil do período calcula o primeiro e o último sinal de atividade
 * na timezone da organização e agrega médias por dia da semana, permitindo
 * identificar padrões (ex.: entra 09:30, mas às quartas entra 11:00).
 * @param input Tenant, guild, colaborador, período e sinal
 * @returns Relatório com dias, padrões por dia da semana e resumo
 * @throws {Error} Quando ids forem inválidos ou colaborador não existir
 */
export async function getMemberJourneyReport(input: MemberJourneyReportInput): Promise<MemberJourneyReport> {
  const organizationId = parseObjectId(input.organizationId, 'organizationId');
  const trackedUserId = parseObjectId(input.trackedUserId, 'trackedUserId');
  const signal: MemberJourneySignal = input.signal === 'voice' ? 'voice' : 'presence';
  const includeIgnoredChannels = input.includeIgnoredChannels === true;
  const now = input.now ?? new Date();

  const trackedUser = await TrackedUserModel.findOne({
    _id: trackedUserId,
    organizationId,
    guildId: input.guildId,
  })
    .select({ discordId: 1, displayName: 1 })
    .lean()
    .exec();

  if (!trackedUser) {
    throw new Error('Colaborador não encontrado nesta organização');
  }

  const timezone = await resolveOrganizationTimezone(organizationId);
  const rawPeriod = resolveRawPeriod(input);
  const { periodStart, periodEnd } = snapPeriodToTimezone(rawPeriod.from, rawPeriod.to, timezone);
  const windowEnd = new Date(Math.min(periodEnd.getTime(), now.getTime()));

  const coreUser = await User.find({ discordId: trackedUser.discordId })
    .select({ _id: 1 })
    .lean()
    .exec();

  const journeySessions =
    coreUser.length > 0
      ? await fetchJourneySessions(
          coreUser[0]._id as Types.ObjectId,
          organizationId,
          input.guildId,
          signal,
          periodStart,
          windowEnd,
          includeIgnoredChannels,
        )
      : [];

  const candidates =
    journeySessions.length > 0
      ? computeDailyJourney(journeySessions, periodStart, windowEnd, timezone)
      : new Map<string, { entry: number; exit: number }>();

  const sessionSegmentsByDay =
    signal === 'voice' && journeySessions.length > 0
      ? computeDailySessionSegments(journeySessions, periodStart, windowEnd, timezone)
      : new Map<string, MemberJourneySessionSegment[]>();

  const listEnd = windowEnd.getTime() >= periodStart.getTime() ? windowEnd : periodStart;
  const civilDays = listCivilDays(periodStart, listEnd, timezone);
  const days: MemberJourneyDay[] = civilDays.map((date) => {
    const candidate = candidates.get(date);
    const weekday = weekdayOfCivilDate(date);
    const sessions = sessionSegmentsByDay.get(date) ?? [];
    if (!candidate) {
      return {
        date,
        weekday,
        hasActivity: false,
        entryMinute: null,
        exitMinute: null,
        entryLabel: null,
        exitLabel: null,
        spanMinutes: 0,
        sessions,
      };
    }

    return {
      date,
      weekday,
      hasActivity: true,
      entryMinute: candidate.entry,
      exitMinute: candidate.exit,
      entryLabel: minutesToLabel(candidate.entry),
      exitLabel: minutesToLabel(candidate.exit),
      spanMinutes: Math.max(0, candidate.exit - candidate.entry),
      sessions,
    };
  });

  const weekdayPatterns = summarizeWeekdayPatterns(days);
  const activeDays = days.filter((day) => day.hasActivity);
  const avgEntry = averageMinutes(activeDays.map((day) => day.entryMinute as number));
  const avgExit = averageMinutes(activeDays.map((day) => day.exitMinute as number));
  const avgSpanMinutes = averageMinutes(activeDays.map((day) => day.spanMinutes)) ?? 0;

  const collaborationSegments =
    signal === 'voice'
      ? days.flatMap((day) => day.sessions.filter((segment) => !segment.isIgnoredChannel))
      : [];
  const collaborationEntryLabels = collaborationSegments.map((segment) => segment.entryLabel);
  const totalCollaborationMinutes = collaborationSegments.reduce(
    (acc, segment) => acc + segment.spanMinutes,
    0,
  );
  const collaborationActiveDays = days.filter((day) =>
    day.sessions.some((segment) => !segment.isIgnoredChannel),
  ).length;
  const avgDailyCollaborationHours =
    collaborationActiveDays > 0
      ? Number((totalCollaborationMinutes / collaborationActiveDays / 60).toFixed(2))
      : 0;

  return {
    trackedUserId: String(trackedUser._id),
    discordId: trackedUser.discordId,
    displayName: trackedUser.displayName,
    timezone,
    signal,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    generatedAt: now.toISOString(),
    days,
    weekdayPatterns,
    summary: {
      totalDays: days.length,
      daysWithActivity: activeDays.length,
      avgEntryMinute: avgEntry,
      avgExitMinute: avgExit,
      avgEntryLabel: avgEntry === null ? null : minutesToLabel(avgEntry),
      avgExitLabel: avgExit === null ? null : minutesToLabel(avgExit),
      avgSpanHours: Number((avgSpanMinutes / 60).toFixed(2)),
      voiceEntryCount: collaborationEntryLabels.length,
      collaborationEntryLabels,
      totalCollaborationMinutes,
      avgDailyCollaborationHours,
    },
  };
}
