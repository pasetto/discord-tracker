import { describe, expect, it } from 'vitest';
import type { WorkCalendar } from '../../src/db/models/WorkCalendar';
import { isBusinessDay } from '../../src/services/workCalendarService';

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
