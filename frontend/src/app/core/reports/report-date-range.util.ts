import { HttpParams } from '@angular/common/http';

/** Presets de período disponíveis nos relatórios. */
export type ReportDatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'last_7_days'
  | 'custom';

/** Intervalo temporal selecionado na UI de relatórios. */
export interface ReportDateRangeValue {
  preset: ReportDatePreset;
  from: Date;
  to: Date;
}

/** Rótulos amigáveis dos presets de período. */
export const REPORT_DATE_PRESET_LABELS: Record<Exclude<ReportDatePreset, 'custom'>, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  this_week: 'Esta semana',
  last_week: 'Semana passada',
  last_7_days: 'Últimos 7 dias',
};

/**
 * Retorna início do dia UTC para uma data.
 * @param value Data de referência
 * @returns Meia-noite UTC
 */
function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/**
 * Retorna fim do dia UTC para uma data.
 * @param value Data de referência
 * @returns Último instante do dia UTC
 */
function endOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));
}

/**
 * Retorna início da semana (segunda-feira) em UTC.
 * @param value Data de referência
 * @returns Segunda-feira UTC
 */
function startOfUtcWeek(value: Date): Date {
  const day = value.getUTCDay();
  const offsetToMonday = day === 0 ? 6 : day - 1;
  return new Date(startOfUtcDay(value).getTime() - offsetToMonday * 24 * 60 * 60 * 1000);
}

/**
 * Retorna fim da semana (domingo) em UTC.
 * @param value Data de referência
 * @returns Domingo 23:59:59.999 UTC
 */
function endOfUtcWeek(value: Date): Date {
  const weekStart = startOfUtcWeek(value);
  const sunday = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  return endOfUtcDay(sunday);
}

/**
 * Converte string `YYYY-MM-DD` em Date UTC no início do dia.
 * @param value Data no formato de input date
 * @returns Date UTC
 */
function parseInputDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Resolve intervalo temporal a partir de preset ou datas customizadas.
 * @param preset Preset selecionado
 * @param customFrom Data inicial quando preset = custom (YYYY-MM-DD)
 * @param customTo Data final quando preset = custom (YYYY-MM-DD)
 * @param now Referência temporal (default: agora)
 * @returns Intervalo normalizado
 */
export function resolveReportDateRange(
  preset: ReportDatePreset,
  customFrom?: string,
  customTo?: string,
  now: Date = new Date(),
): ReportDateRangeValue {
  if (preset === 'custom') {
    if (!customFrom || !customTo) {
      throw new Error('Informe data inicial e final para período personalizado.');
    }
    const from = parseInputDate(customFrom);
    const to = endOfUtcDay(parseInputDate(customTo));
    if (from.getTime() > to.getTime()) {
      throw new Error('Data inicial deve ser anterior ou igual à data final.');
    }
    return { preset, from, to };
  }

  const todayStart = startOfUtcDay(now);
  const todayEnd = endOfUtcDay(now);

  switch (preset) {
    case 'today':
      return { preset, from: todayStart, to: todayEnd };
    case 'yesterday': {
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      return { preset, from: yesterdayStart, to: endOfUtcDay(yesterdayStart) };
    }
    case 'this_week':
      return { preset, from: startOfUtcWeek(now), to: todayEnd };
    case 'last_week': {
      const thisWeekStart = startOfUtcWeek(now);
      const lastWeekEnd = endOfUtcDay(new Date(thisWeekStart.getTime() - 24 * 60 * 60 * 1000));
      return { preset, from: startOfUtcWeek(lastWeekEnd), to: lastWeekEnd };
    }
    case 'last_7_days':
      return {
        preset,
        from: new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000),
        to: todayEnd,
      };
    default:
      return { preset: 'this_week', from: startOfUtcWeek(now), to: todayEnd };
  }
}

/**
 * Converte intervalo selecionado em query params HTTP para a API.
 * @param range Intervalo resolvido
 * @returns HttpParams com preset ou from/to
 */
export function toReportDateHttpParams(range: ReportDateRangeValue): HttpParams {
  if (range.preset === 'custom') {
    return new HttpParams()
      .set('from', range.from.toISOString())
      .set('to', range.to.toISOString());
  }

  return new HttpParams().set('preset', range.preset);
}

/**
 * Formata intervalo para exibição compacta na UI.
 * @param range Intervalo selecionado
 * @returns Texto legível do período
 */
export function formatReportDateRangeLabel(range: ReportDateRangeValue): string {
  if (range.preset !== 'custom') {
    return REPORT_DATE_PRESET_LABELS[range.preset];
  }

  const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' });
  return `${formatter.format(range.from)} — ${formatter.format(range.to)}`;
}
