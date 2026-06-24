import type { WorkCalendar, WorkWeekDayKey } from '../db/models/WorkCalendar';
import { formatDateString, getZonedParts, zonedDateTimeToUtc } from './timezone';

/** Janela de trabalho de um dia em instantes UTC. */
export interface WorkWindowBounds {
  workStartUtc: Date;
  workEndUtc: Date;
  totalWorkSeconds: number;
}

/** Métricas da jornada já decorrida no dia de referência. */
export interface ElapsedWorkWindowMetrics {
  isBusinessDay: boolean;
  isWithinWorkHours: boolean;
  elapsedWorkSeconds: number;
  totalWorkSeconds: number;
  elapsedPercent: number;
  bounds: WorkWindowBounds | null;
}

const WEEKDAY_TO_KEY: Record<string, WorkWeekDayKey> = {
  Sun: 'sunday',
  Mon: 'monday',
  Tue: 'tuesday',
  Wed: 'wednesday',
  Thu: 'thursday',
  Fri: 'friday',
  Sat: 'saturday',
};

/**
 * Verifica se a data é feriado no calendário (incluindo recorrência anual).
 * @param holidays Lista de feriados configurados
 * @param targetIsoDate Data alvo YYYY-MM-DD
 * @returns true quando há feriado aplicável
 */
function isHolidayOnDate(
  holidays: WorkCalendar['holidays'],
  targetIsoDate: string,
): boolean {
  const targetMonthDay = targetIsoDate.slice(5);
  return holidays.some((holiday) => {
    if (holiday.date === targetIsoDate) {
      return true;
    }
    return Boolean(holiday.recurring) && holiday.date.slice(5) === targetMonthDay;
  });
}

/**
 * Determina se a data é dia útil na timezone informada.
 * @param calendar Calendário com jornada e feriados
 * @param date Instante de referência
 * @param timeZone Timezone IANA
 * @returns true quando o dia é útil conforme calendário
 */
export function isBusinessDayInTimezone(
  calendar: Pick<WorkCalendar, 'workWeek' | 'holidays'>,
  date: Date,
  timeZone: string,
): boolean {
  const weekdayKey = getWorkWeekDayKey(date, timeZone);
  if (!calendar.workWeek[weekdayKey].enabled) {
    return false;
  }

  const isoDate = formatDateString(date, timeZone);
  return !isHolidayOnDate(calendar.holidays, isoDate);
}

/**
 * Converte string HH:mm em minutos desde meia-noite.
 * @param value Horário textual (ex.: 09:00)
 * @param fallbackMinutes Valor padrão quando inválido
 * @returns Minutos desde 00:00
 * @example
 * parseWorkTimeString('09:30') // 570
 */
export function parseWorkTimeString(value: string | undefined, fallbackMinutes = 540): number {
  if (!value) {
    return fallbackMinutes;
  }

  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return fallbackMinutes;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return fallbackMinutes;
  }

  return hours * 60 + minutes;
}

/**
 * Resolve chave do dia da semana na timezone informada.
 * @param date Instante de referência
 * @param timeZone Timezone IANA
 * @returns Chave do dia na jornada semanal
 */
function getWorkWeekDayKey(date: Date, timeZone: string): WorkWeekDayKey {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  return WEEKDAY_TO_KEY[weekday] ?? 'monday';
}

/**
 * Retorna limites UTC da jornada de trabalho para o dia civil na timezone.
 * @param calendar Calendário com jornada e feriados
 * @param referenceDate Instante de referência
 * @param timeZone Timezone IANA da organização
 * @returns Janela de trabalho ou null quando não é dia útil
 */
export function getWorkWindowBounds(
  calendar: Pick<WorkCalendar, 'workWeek' | 'holidays'>,
  referenceDate: Date,
  timeZone: string,
): WorkWindowBounds | null {
  if (!isBusinessDayInTimezone(calendar, referenceDate, timeZone)) {
    return null;
  }

  const parts = getZonedParts(referenceDate, timeZone);
  const weekdayKey = getWorkWeekDayKey(referenceDate, timeZone);
  const schedule = calendar.workWeek[weekdayKey];

  if (!schedule.enabled) {
    return null;
  }

  const startMinutes = parseWorkTimeString(schedule.startTime, 540);
  const endMinutes = parseWorkTimeString(schedule.endTime, 1080);
  if (endMinutes <= startMinutes) {
    return null;
  }

  const startHour = Math.floor(startMinutes / 60);
  const startMinute = startMinutes % 60;
  const endHour = Math.floor(endMinutes / 60);
  const endMinute = endMinutes % 60;

  const workStartUtc = zonedDateTimeToUtc(parts.year, parts.month, parts.day, startHour, startMinute, 0, timeZone);
  const workEndUtc = zonedDateTimeToUtc(parts.year, parts.month, parts.day, endHour, endMinute, 0, timeZone);
  const totalWorkSeconds = Math.floor((workEndUtc.getTime() - workStartUtc.getTime()) / 1000);

  return { workStartUtc, workEndUtc, totalWorkSeconds };
}

/**
 * Calcula quanto da jornada útil já passou até o instante informado.
 * @param calendar Calendário com jornada e feriados
 * @param referenceDate Instante de referência (default: agora)
 * @param timeZone Timezone IANA da organização
 * @returns Métricas de tempo decorrido na jornada
 */
export function getElapsedWorkWindowMetrics(
  calendar: Pick<WorkCalendar, 'workWeek' | 'holidays'>,
  referenceDate: Date = new Date(),
  timeZone: string,
): ElapsedWorkWindowMetrics {
  const bounds = getWorkWindowBounds(calendar, referenceDate, timeZone);
  if (!bounds) {
    return {
      isBusinessDay: false,
      isWithinWorkHours: false,
      elapsedWorkSeconds: 0,
      totalWorkSeconds: 0,
      elapsedPercent: 0,
      bounds: null,
    };
  }

  const nowMs = referenceDate.getTime();
  const startMs = bounds.workStartUtc.getTime();
  const endMs = bounds.workEndUtc.getTime();

  if (nowMs < startMs) {
    return {
      isBusinessDay: true,
      isWithinWorkHours: false,
      elapsedWorkSeconds: 0,
      totalWorkSeconds: bounds.totalWorkSeconds,
      elapsedPercent: 0,
      bounds,
    };
  }

  const effectiveEndMs = Math.min(nowMs, endMs);
  const elapsedWorkSeconds = Math.max(0, Math.floor((effectiveEndMs - startMs) / 1000));
  const elapsedPercent = bounds.totalWorkSeconds > 0
    ? Math.min(100, Number(((elapsedWorkSeconds / bounds.totalWorkSeconds) * 100).toFixed(2)))
    : 0;

  return {
    isBusinessDay: true,
    isWithinWorkHours: nowMs >= startMs && nowMs <= endMs,
    elapsedWorkSeconds,
    totalWorkSeconds: bounds.totalWorkSeconds,
    elapsedPercent,
    bounds,
  };
}
