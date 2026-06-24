/**
 * Calcula segundos de sobreposição entre sessão e janela de tempo.
 * @param sessionStart Início da sessão
 * @param sessionEnd Fim da sessão (null = ainda aberta)
 * @param windowStart Início da janela
 * @param windowEnd Fim da janela
 * @returns Segundos sobrepostos (>= 0)
 */
export function overlapSeconds(
  sessionStart: Date,
  sessionEnd: Date | null,
  windowStart: Date,
  windowEnd: Date,
): number {
  const effectiveStart = Math.max(sessionStart.getTime(), windowStart.getTime());
  const effectiveEnd = Math.min((sessionEnd ?? windowEnd).getTime(), windowEnd.getTime());
  if (effectiveEnd <= effectiveStart) {
    return 0;
  }
  return Math.floor((effectiveEnd - effectiveStart) / 1000);
}

/**
 * Retorna início do dia UTC para filtros diários.
 * @param date Data de referência
 * @returns Meia-noite UTC
 */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Retorna fim do dia UTC (23:59:59.999).
 * @param date Data de referência
 * @returns Último instante do dia UTC
 */
export function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

/**
 * Retorna início da semana (segunda-feira) em UTC.
 * @param date Data de referência
 * @returns Segunda-feira da semana
 */
export function startOfUtcWeek(date: Date): Date {
  const day = date.getUTCDay();
  const offsetToMonday = day === 0 ? 6 : day - 1;
  return new Date(startOfUtcDay(date).getTime() - offsetToMonday * 24 * 60 * 60 * 1000);
}

/**
 * Retorna fim da semana (domingo 23:59:59.999 UTC) para a semana da data informada.
 * @param date Data de referência
 * @returns Último instante do domingo da semana UTC
 */
export function endOfUtcWeek(date: Date): Date {
  const weekStart = startOfUtcWeek(date);
  const sunday = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  return endOfUtcDay(sunday);
}

/**
 * Conta dias de calendário inclusivos entre duas datas UTC (início/fim de dia).
 * @param from Início do intervalo
 * @param to Fim do intervalo
 * @returns Quantidade de dias inclusivos (>= 1 quando from <= to)
 */
export function countInclusiveUtcDays(from: Date, to: Date): number {
  const start = startOfUtcDay(from).getTime();
  const end = startOfUtcDay(to).getTime();
  if (end < start) {
    return 0;
  }
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

/**
 * Retorna início do mês em UTC.
 * @param date Data de referência
 * @returns Primeiro dia do mês UTC
 */
export function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
