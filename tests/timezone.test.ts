import { describe, it, expect } from 'vitest';
import {
  getDayBounds,
  getMonthBounds,
  parseDateString,
  formatDateString,
  zonedDateTimeToUtc,
} from '../src/utils/timezone';

describe('timezone America/Sao_Paulo', () => {
  it('retorna início do dia em UTC-3 (sem horário de verão)', () => {
    const date = new Date('2026-06-19T15:30:00Z');
    const { start, end } = getDayBounds(date);

    expect(start.toISOString()).toBe('2026-06-19T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-06-20T03:00:00.000Z');
  });

  it('retorna intervalo do mês na timezone', () => {
    const { start, end } = getMonthBounds(2026, 6);

    expect(start.toISOString()).toBe('2026-06-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-07-01T03:00:00.000Z');
  });

  it('interpreta YYYY-MM-DD como dia civil em São Paulo', () => {
    const date = parseDateString('2026-06-19');
    expect(date.toISOString()).toBe('2026-06-19T03:00:00.000Z');
  });

  it('formata data na timezone configurada', () => {
    const date = zonedDateTimeToUtc(2026, 6, 19, 14, 30, 0);
    expect(formatDateString(date)).toBe('2026-06-19');
  });
});
