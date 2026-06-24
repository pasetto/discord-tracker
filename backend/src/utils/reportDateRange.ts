import {
  countInclusiveUtcDays,
  endOfUtcDay,
  endOfUtcWeek,
  startOfUtcDay,
  startOfUtcWeek,
} from './sessionTimeUtils';

/** Presets de período suportados nos relatórios. */
export type ReportDatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'last_7_days'
  | 'custom';

/** Intervalo temporal normalizado para consultas de relatório. */
export interface ReportDateRange {
  from: Date;
  to: Date;
  preset: ReportDatePreset;
}

/** Opções de validação ao parsear intervalo de relatório. */
export interface ParseReportDateRangeOptions {
  /** Data de referência para presets (default: agora) */
  now?: Date;
  /** Máximo de dias inclusivos permitidos no intervalo customizado */
  maxDays?: number;
}

const DEFAULT_MAX_DAYS = 366;

/**
 * Resolve intervalo temporal a partir de um preset conhecido.
 * @param preset Preset selecionado na UI
 * @param now Data de referência (default: agora)
 * @returns Intervalo UTC normalizado com início/fim de dia
 * @example
 * resolveReportDateRangeFromPreset('yesterday').from // ontem 00:00 UTC
 */
export function resolveReportDateRangeFromPreset(
  preset: ReportDatePreset,
  now: Date = new Date(),
): ReportDateRange {
  const todayStart = startOfUtcDay(now);
  const todayEnd = endOfUtcDay(now);

  switch (preset) {
    case 'today':
      return { from: todayStart, to: todayEnd, preset };
    case 'yesterday': {
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      return { from: yesterdayStart, to: endOfUtcDay(yesterdayStart), preset };
    }
    case 'this_week':
      return { from: startOfUtcWeek(now), to: todayEnd, preset };
    case 'last_week': {
      const thisWeekStart = startOfUtcWeek(now);
      const lastWeekEnd = endOfUtcDay(new Date(thisWeekStart.getTime() - 24 * 60 * 60 * 1000));
      return { from: startOfUtcWeek(lastWeekEnd), to: lastWeekEnd, preset };
    }
    case 'last_7_days': {
      const from = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
      return { from, to: todayEnd, preset };
    }
    default:
      return { from: startOfUtcWeek(now), to: todayEnd, preset: 'this_week' };
  }
}

/**
 * Converte string ISO em data válida.
 * @param value Valor textual recebido na query string
 * @param label Nome do parâmetro para mensagens de erro
 * @returns Data parseada
 * @throws {Error} Quando valor ausente ou inválido
 */
export function parseIsoDateParam(value: string | undefined, label: string): Date {
  if (!value) {
    throw new Error(`Parâmetro ${label} é obrigatório`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Parâmetro ${label} inválido: use formato ISO-8601`);
  }
  return parsed;
}

/**
 * Normaliza par from/to para limites UTC de dia e valida intervalo.
 * @param from Início informado
 * @param to Fim informado
 * @param options Opções de validação
 * @returns Intervalo normalizado
 * @throws {Error} Quando intervalo é inválido ou excede limite
 */
export function normalizeCustomReportDateRange(
  from: Date,
  to: Date,
  options: ParseReportDateRangeOptions = {},
): ReportDateRange {
  const maxDays = options.maxDays ?? DEFAULT_MAX_DAYS;
  const normalizedFrom = startOfUtcDay(from);
  const normalizedTo = endOfUtcDay(to);

  if (normalizedFrom.getTime() > normalizedTo.getTime()) {
    throw new Error('Intervalo inválido: from deve ser anterior ou igual a to');
  }

  const days = countInclusiveUtcDays(normalizedFrom, normalizedTo);
  if (days > maxDays) {
    throw new Error(`Intervalo máximo permitido: ${maxDays} dias`);
  }

  return { from: normalizedFrom, to: normalizedTo, preset: 'custom' };
}

/**
 * Resolve intervalo de relatório a partir de query params (`preset` ou `from`+`to`).
 * @param params Query params da requisição HTTP
 * @param options Opções de parse e validação
 * @returns Intervalo pronto para serviços de relatório
 * @throws {Error} Quando combinação de parâmetros for inválida
 */
export function parseReportDateRangeQuery(
  params: { preset?: string; from?: string; to?: string },
  options: ParseReportDateRangeOptions = {},
): ReportDateRange {
  const now = options.now ?? new Date();

  if (params.from || params.to) {
    const from = parseIsoDateParam(params.from, 'from');
    const to = parseIsoDateParam(params.to, 'to');
    return normalizeCustomReportDateRange(from, to, options);
  }

  const preset = (params.preset ?? 'this_week') as ReportDatePreset;
  const allowed: ReportDatePreset[] = [
    'today',
    'yesterday',
    'this_week',
    'last_week',
    'last_7_days',
    'custom',
  ];

  if (!allowed.includes(preset)) {
    throw new Error('preset inválido');
  }

  if (preset === 'custom') {
    throw new Error('Para preset custom informe from e to');
  }

  return resolveReportDateRangeFromPreset(preset, now);
}
