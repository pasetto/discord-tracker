import { describe, expect, it } from 'vitest';
import type { WorkCalendar } from '../../src/db/models/WorkCalendar';
import { countInclusiveBusinessDaysInPeriod, isBusinessDay } from '../../src/services/workCalendarService';

const weekdayCalendar: Pick<WorkCalendar, 'workWeek' | 'holidays'> = {
  workWeek: {
    monday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    tuesday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    wednesday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    thursday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    friday: { enabled: true, startTime: '09:00', endTime: '18:00' },
    saturday: { enabled: false },
    sunday: { enabled: false },
  },
  holidays: [{ date: '2026-07-01', name: 'Feriado local', type: 'company_custom' }],
};

const brCalendar: WorkCalendar = {
  workWeek: {
    monday: { enabled: true },
    tuesday: { enabled: true },
    wednesday: { enabled: true },
    thursday: { enabled: true },
    friday: { enabled: true },
    saturday: { enabled: false },
    sunday: { enabled: false },
  },
  holidays: [{ date: '2026-12-25', name: 'Natal', type: 'national_br' }],
  brNationalHolidaysSeeded: true,
};

describe('isBusinessDay', () => {
  it('sábado retorna false', () => {
    expect(isBusinessDay(brCalendar, new Date('2026-06-20'))).toBe(false);
  });

  it('natal retorna false', () => {
    expect(isBusinessDay(brCalendar, new Date('2026-12-25'))).toBe(false);
  });

  it('terça útil retorna true', () => {
    expect(isBusinessDay(brCalendar, new Date('2026-06-23'))).toBe(true);
  });
});

describe('countInclusiveBusinessDaysInPeriod', () => {
  it('conta dias úteis inclusivos entre periodStart e periodEnd', () => {
    const from = new Date('2026-06-30T00:00:00.000Z');
    const to = new Date('2026-07-02T23:59:59.999Z');

    expect(
      countInclusiveBusinessDaysInPeriod({ ...weekdayCalendar, holidays: [] }, from, to),
    ).toBe(3);
  });

  it('exclui feriados cadastrados no calendário', () => {
    const from = new Date('2026-06-30T00:00:00.000Z');
    const to = new Date('2026-07-01T23:59:59.999Z');

    expect(countInclusiveBusinessDaysInPeriod(weekdayCalendar, from, to)).toBe(1);
  });

  it('exclui dias cobertos por PTO via callback', () => {
    const from = new Date('2026-06-30T00:00:00.000Z');
    const to = new Date('2026-07-02T23:59:59.999Z');

    expect(
      countInclusiveBusinessDaysInPeriod(
        { ...weekdayCalendar, holidays: [] },
        from,
        to,
        (date) => date.toISOString().startsWith('2026-07-02'),
      ),
    ).toBe(2);
  });

  it('retorna 0 quando intervalo inválido', () => {
    const from = new Date('2026-07-02T00:00:00.000Z');
    const to = new Date('2026-06-30T00:00:00.000Z');

    expect(countInclusiveBusinessDaysInPeriod(weekdayCalendar, from, to)).toBe(0);
  });
});
