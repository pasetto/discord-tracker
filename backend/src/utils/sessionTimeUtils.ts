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
 * Retorna início do mês em UTC.
 * @param date Data de referência
 * @returns Primeiro dia do mês UTC
 */
export function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
