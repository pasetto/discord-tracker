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

/** Intervalo de tempo em epoch (ms). */
export interface TimeIntervalMs {
  /** Início em epoch ms. */
  start: number;
  /** Fim em epoch ms. */
  end: number;
}

/**
 * Soma a duração (em segundos) da UNIÃO de intervalos, mesclando sobreposições.
 *
 * Evita contagem dupla quando há sessões abertas/sobrepostas do mesmo usuário
 * (ex.: sessões órfãs criadas por corridas de eventos do Discord). Como uma pessoa
 * só tem um status/canal por vez, o tempo real é a união — nunca a soma — dos
 * intervalos. Garante que o total jamais ultrapasse o tempo de relógio da janela.
 * @param intervals Lista de intervalos `{ start, end }` em epoch ms
 * @returns Segundos totais cobertos pela união dos intervalos (>= 0)
 * @example
 * // duas sessões idênticas e sobrepostas contam uma só vez
 * unionDurationSeconds([{ start: 0, end: 3600_000 }, { start: 0, end: 3600_000 }]) // 3600
 */
export function unionDurationSeconds(intervals: TimeIntervalMs[]): number {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .sort((left, right) => left.start - right.start);

  if (sorted.length === 0) {
    return 0;
  }

  let totalMs = 0;
  let currentStart = sorted[0].start;
  let currentEnd = sorted[0].end;

  for (let index = 1; index < sorted.length; index += 1) {
    const { start, end } = sorted[index];
    if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
    } else {
      totalMs += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    }
  }

  totalMs += currentEnd - currentStart;
  return Math.floor(totalMs / 1000);
}

/**
 * Recorta uma sessão a uma janela e retorna o intervalo efetivo em epoch ms.
 * @param sessionStart Início da sessão
 * @param sessionEnd Fim da sessão (null = ainda aberta, usa fim da janela)
 * @param windowStart Início da janela
 * @param windowEnd Fim da janela
 * @returns Intervalo recortado ou null quando não há sobreposição
 */
export function clipToWindow(
  sessionStart: Date,
  sessionEnd: Date | null,
  windowStart: Date,
  windowEnd: Date,
): TimeIntervalMs | null {
  const start = Math.max(sessionStart.getTime(), windowStart.getTime());
  const end = Math.min((sessionEnd ?? windowEnd).getTime(), windowEnd.getTime());
  if (end <= start) {
    return null;
  }
  return { start, end };
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

/**
 * Retorna o máximo de segundos decorridos em uma janela temporal.
 * @param windowStart Início da janela
 * @param windowEnd Fim da janela (exclusivo ou inclusivo — usa diferença em ms)
 * @returns Segundos de relógio na janela (>= 0)
 */
export function maxElapsedSecondsInWindow(windowStart: Date, windowEnd: Date): number {
  const deltaMs = windowEnd.getTime() - windowStart.getTime();
  return deltaMs > 0 ? Math.floor(deltaMs / 1000) : 0;
}

/**
 * Limita um total diário ao tempo máximo possível na janela (defesa contra sessões órfãs somadas).
 * @param totalSeconds Total calculado
 * @param windowStart Início do dia/janela
 * @param windowEnd Fim da janela (geralmente "agora")
 * @returns Segundos limitados ao intervalo físico do dia
 */
export function clampSecondsToWindow(totalSeconds: number, windowStart: Date, windowEnd: Date): number {
  const maxSeconds = maxElapsedSecondsInWindow(windowStart, windowEnd);
  return Math.min(Math.max(0, totalSeconds), maxSeconds);
}
