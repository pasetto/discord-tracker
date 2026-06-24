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
