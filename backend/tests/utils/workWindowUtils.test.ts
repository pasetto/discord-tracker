import { describe, expect, it } from 'vitest';
import { createDefaultWorkWeek } from '../../src/db/models/WorkCalendar';
import {
  getElapsedWorkWindowMetrics,
  getWorkWindowBounds,
  parseWorkTimeString,
} from '../../src/utils/workWindowUtils';

describe('parseWorkTimeString', () => {
  it('converte HH:mm em minutos desde meia-noite', () => {
    expect(parseWorkTimeString('09:30')).toBe(570);
    expect(parseWorkTimeString('18:00')).toBe(1080);
  });

  it('usa fallback quando horário é inválido', () => {
    expect(parseWorkTimeString(undefined, 540)).toBe(540);
    expect(parseWorkTimeString('invalid', 600)).toBe(600);
  });
});

describe('getWorkWindowBounds', () => {
  const calendar = {
    workWeek: createDefaultWorkWeek(),
    holidays: [] as Array<{ date: string; name: string; type: 'national_br' | 'company_custom' }>,
  };

  it('retorna janela 09:00-18:00 em dia útil (America/Sao_Paulo)', () => {
    const reference = new Date('2026-06-24T15:00:00.000Z');
    const bounds = getWorkWindowBounds(calendar, reference, 'America/Sao_Paulo');

    expect(bounds).not.toBeNull();
    expect(bounds?.totalWorkSeconds).toBe(9 * 3600);
    expect(bounds!.workStartUtc.getTime()).toBeLessThan(bounds!.workEndUtc.getTime());
  });

  it('retorna null em fim de semana', () => {
    const reference = new Date('2026-06-28T15:00:00.000Z');
    const bounds = getWorkWindowBounds(calendar, reference, 'America/Sao_Paulo');

    expect(bounds).toBeNull();
  });
});

describe('getElapsedWorkWindowMetrics', () => {
  const calendar = {
    workWeek: createDefaultWorkWeek(),
    holidays: [] as Array<{ date: string; name: string; type: 'national_br' | 'company_custom' }>,
  };

  it('calcula percentual decorrido no meio da jornada', () => {
    const now = new Date('2026-06-24T15:00:00.000Z');
    const metrics = getElapsedWorkWindowMetrics(calendar, now, 'America/Sao_Paulo');

    expect(metrics.isBusinessDay).toBe(true);
    expect(metrics.isWithinWorkHours).toBe(true);
    expect(metrics.elapsedWorkSeconds).toBeGreaterThan(0);
    expect(metrics.elapsedPercent).toBeGreaterThan(0);
    expect(metrics.elapsedPercent).toBeLessThanOrEqual(100);
  });

  it('retorna zero percentual antes do início da jornada', () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const metrics = getElapsedWorkWindowMetrics(calendar, now, 'America/Sao_Paulo');

    expect(metrics.isBusinessDay).toBe(true);
    expect(metrics.isWithinWorkHours).toBe(false);
    expect(metrics.elapsedWorkSeconds).toBe(0);
    expect(metrics.elapsedPercent).toBe(0);
  });
});
