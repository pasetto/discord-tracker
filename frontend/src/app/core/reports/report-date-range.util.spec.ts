import { describe, expect, it } from 'vitest';
import {
  REPORT_DATE_PRESET_LABELS,
  resolveReportDateRange,
  toReportDateHttpParams,
} from './report-date-range.util';

describe('report-date-range.util', () => {
  const now = new Date('2026-06-24T12:00:00.000Z');

  it('resolve preset yesterday', () => {
    const range = resolveReportDateRange('yesterday', undefined, undefined, now);
    expect(range.from.toISOString()).toBe('2026-06-23T00:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-06-23T23:59:59.999Z');
  });

  it('gera query params com preset', () => {
    const params = toReportDateHttpParams(resolveReportDateRange('last_week', undefined, undefined, now));
    expect(params.get('preset')).toBe('last_week');
  });

  it('gera query params customizados com from/to', () => {
    const range = resolveReportDateRange('custom', '2026-06-10', '2026-06-12', now);
    const params = toReportDateHttpParams(range);
    expect(params.get('from')).toContain('2026-06-10');
    expect(params.get('to')).toContain('2026-06-12');
  });

  it('expõe rótulos em português para presets', () => {
    expect(REPORT_DATE_PRESET_LABELS.yesterday).toBe('Ontem');
    expect(REPORT_DATE_PRESET_LABELS.last_week).toBe('Semana passada');
  });
});
