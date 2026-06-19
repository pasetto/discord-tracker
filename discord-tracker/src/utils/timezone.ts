import { config } from '../config/env';

/** Timezone IANA padrão da aplicação (Brasília). */
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

/**
 * Partes de uma data/hora em uma timezone IANA.
 */
export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Extrai componentes de data/hora de um instante na timezone informada.
 * @param date Instante UTC
 * @param timeZone Timezone IANA (default: config.timezone)
 * @returns Partes da data local
 */
export function getZonedParts(date: Date, timeZone: string = config.timezone): ZonedParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0');

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * Converte uma data/hora local na timezone para instante UTC.
 * @param year Ano
 * @param month Mês (1-12)
 * @param day Dia
 * @param hour Hora (default 0)
 * @param minute Minuto (default 0)
 * @param second Segundo (default 0)
 * @param timeZone Timezone IANA
 * @returns Date UTC equivalente
 */
export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  timeZone: string = config.timezone,
): Date {
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let i = 0; i < 4; i++) {
    const parts = getZonedParts(new Date(utc), timeZone);
    const desired = Date.UTC(year, month - 1, day, hour, minute, second);
    const actual = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    utc += desired - actual;
  }

  return new Date(utc);
}

/**
 * Retorna início e fim do dia na timezone configurada.
 * @param date Data de referência
 * @param timeZone Timezone IANA (opcional)
 * @returns Intervalo [start, end) em UTC
 */
export function getDayBounds(date: Date, timeZone: string = config.timezone): { start: Date; end: Date } {
  const parts = getZonedParts(date, timeZone);
  const start = zonedDateTimeToUtc(parts.year, parts.month, parts.day, 0, 0, 0, timeZone);

  const noonUtc = zonedDateTimeToUtc(parts.year, parts.month, parts.day, 12, 0, 0, timeZone);
  const nextDayParts = getZonedParts(new Date(noonUtc.getTime() + 24 * 60 * 60 * 1000), timeZone);
  const end = zonedDateTimeToUtc(nextDayParts.year, nextDayParts.month, nextDayParts.day, 0, 0, 0, timeZone);

  return { start, end };
}

/**
 * Retorna início e fim do mês na timezone configurada.
 * @param year Ano
 * @param month Mês (1-12)
 * @param timeZone Timezone IANA (opcional)
 * @returns Intervalo [start, end) em UTC
 */
export function getMonthBounds(
  year: number,
  month: number,
  timeZone: string = config.timezone,
): { start: Date; end: Date } {
  const start = zonedDateTimeToUtc(year, month, 1, 0, 0, 0, timeZone);
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const end = zonedDateTimeToUtc(nextMonth.year, nextMonth.month, 1, 0, 0, 0, timeZone);

  return { start, end };
}

/**
 * Interpreta string YYYY-MM-DD como dia civil na timezone configurada.
 * @param dateStr Data no formato ISO date (YYYY-MM-DD)
 * @returns Instante UTC do início desse dia na timezone
 * @throws {Error} Quando o formato é inválido
 */
export function parseDateString(dateStr: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw new Error('Data inválida. Use formato YYYY-MM-DD');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  return zonedDateTimeToUtc(year, month, day, 0, 0, 0);
}

/**
 * Formata instante como YYYY-MM-DD na timezone configurada.
 * @param date Instante UTC
 * @param timeZone Timezone IANA (opcional)
 * @returns Data formatada
 */
export function formatDateString(date: Date, timeZone: string = config.timezone): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Formata instante para exibição legível na timezone configurada.
 * @param date Instante UTC
 * @param timeZone Timezone IANA (opcional)
 * @returns String formatada pt-BR
 */
export function formatDateTime(date: Date, timeZone: string = config.timezone): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(date);
}

/**
 * Retorna ano e mês atuais na timezone configurada.
 * @param date Referência (default: agora)
 * @returns Ano e mês (1-12)
 */
export function getCurrentYearMonth(date: Date = new Date()): { year: number; month: number } {
  const parts = getZonedParts(date);
  return { year: parts.year, month: parts.month };
}

/**
 * Normaliza data para chave de relatório diário (início do dia na timezone).
 * @param date Data de referência
 * @returns Início do dia civil na timezone
 */
export function normalizeReportDate(date: Date): Date {
  return getDayBounds(date).start;
}
