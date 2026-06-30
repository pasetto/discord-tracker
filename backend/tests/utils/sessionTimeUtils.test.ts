import { describe, expect, it } from 'vitest';
import {
  clampSecondsToWindow,
  clipToWindow,
  maxElapsedSecondsInWindow,
  overlapSeconds,
  unionDurationSeconds,
} from '../../src/utils/sessionTimeUtils';

const HOUR = 3600_000;

describe('unionDurationSeconds', () => {
  it('retorna 0 para lista vazia', () => {
    expect(unionDurationSeconds([])).toBe(0);
  });

  it('ignora intervalos inválidos (fim <= início)', () => {
    expect(unionDurationSeconds([{ start: 100, end: 100 }, { start: 200, end: 100 }])).toBe(0);
  });

  it('soma intervalos disjuntos', () => {
    const total = unionDurationSeconds([
      { start: 0, end: HOUR },
      { start: 2 * HOUR, end: 3 * HOUR },
    ]);
    expect(total).toBe(7200);
  });

  it('conta uma só vez intervalos idênticos sobrepostos (bug das sessões órfãs)', () => {
    const total = unionDurationSeconds([
      { start: 0, end: HOUR },
      { start: 0, end: HOUR },
      { start: 0, end: HOUR },
    ]);
    expect(total).toBe(3600);
  });

  it('mescla intervalos parcialmente sobrepostos', () => {
    const total = unionDurationSeconds([
      { start: 0, end: 2 * HOUR },
      { start: HOUR, end: 3 * HOUR },
    ]);
    expect(total).toBe(3 * 3600);
  });

  it('nunca ultrapassa o tempo de relógio da janela mesmo com muitas sessões abertas sobrepostas', () => {
    const dayStart = 0;
    const now = 17 * HOUR;
    const overlapping = Array.from({ length: 10 }, () => ({ start: dayStart, end: now }));
    expect(unionDurationSeconds(overlapping)).toBe(17 * 3600);
  });
});

describe('clipToWindow', () => {
  const windowStart = new Date(10 * HOUR);
  const windowEnd = new Date(20 * HOUR);

  it('recorta sessão que extrapola a janela', () => {
    const interval = clipToWindow(new Date(5 * HOUR), new Date(25 * HOUR), windowStart, windowEnd);
    expect(interval).toEqual({ start: 10 * HOUR, end: 20 * HOUR });
  });

  it('usa o fim da janela para sessão aberta (endedAt null)', () => {
    const interval = clipToWindow(new Date(12 * HOUR), null, windowStart, windowEnd);
    expect(interval).toEqual({ start: 12 * HOUR, end: 20 * HOUR });
  });

  it('retorna null quando não há sobreposição', () => {
    expect(clipToWindow(new Date(0), new Date(HOUR), windowStart, windowEnd)).toBeNull();
  });

  it('é coerente com overlapSeconds para uma única sessão', () => {
    const start = new Date(11 * HOUR);
    const end = new Date(15 * HOUR);
    const interval = clipToWindow(start, end, windowStart, windowEnd);
    const seconds = interval ? Math.floor((interval.end - interval.start) / 1000) : 0;
    expect(seconds).toBe(overlapSeconds(start, end, windowStart, windowEnd));
  });
});

describe('clampSecondsToWindow', () => {
  const windowStart = new Date(10 * HOUR);
  const windowEnd = new Date(17 * HOUR);

  it('limita totais inflados ao tempo máximo da janela', () => {
    const max = maxElapsedSecondsInWindow(windowStart, windowEnd);
    expect(clampSecondsToWindow(200_000, windowStart, windowEnd)).toBe(max);
  });

  it('preserva totais válidos dentro da janela', () => {
    expect(clampSecondsToWindow(3 * 3600, windowStart, windowEnd)).toBe(3 * 3600);
  });
});
