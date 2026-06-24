import { describe, expect, it } from 'vitest';
import {
  normalizeCustomReportDateRange,
  parseReportDateRangeQuery,
  resolveReportDateRangeFromPreset,
} from '../../src/utils/reportDateRange';

describe('reportDateRange', () => {
  const now = new Date('2026-06-24T15:00:00.000Z');

  it('resolve preset yesterday com um único dia UTC', () => {
    const range = resolveReportDateRangeFromPreset('yesterday', now);
    expect(range.from.toISOString()).toBe('2026-06-23T00:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-06-23T23:59:59.999Z');
  });

  it('resolve preset last_week de segunda a domingo anterior', () => {
    const range = resolveReportDateRangeFromPreset('last_week', now);
    expect(range.from.toISOString()).toBe('2026-06-15T00:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-06-21T23:59:59.999Z');
  });

  it('parseia intervalo customizado from/to', () => {
    const range = parseReportDateRangeQuery(
      { from: '2026-06-10T08:00:00.000Z', to: '2026-06-12T18:00:00.000Z' },
      { now },
    );
    expect(range.preset).toBe('custom');
    expect(range.from.toISOString()).toBe('2026-06-10T00:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-06-12T23:59:59.999Z');
  });

  it('rejeita intervalo invertido', () => {
    expect(() =>
      normalizeCustomReportDateRange(new Date('2026-06-20T00:00:00.000Z'), new Date('2026-06-10T00:00:00.000Z')),
    ).toThrow(/Intervalo inválido/);
  });
});
