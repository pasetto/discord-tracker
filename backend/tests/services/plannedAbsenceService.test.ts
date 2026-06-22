import { describe, expect, it } from 'vitest';
import { isOnPlannedAbsence } from '../../src/services/plannedAbsenceService';

describe('isOnPlannedAbsence', () => {
  it('retorna true quando data dentro do intervalo active', () => {
    const absences = [
      {
        status: 'active' as const,
        startDate: new Date('2026-06-01T00:00:00.000Z'),
        endDate: new Date('2026-06-30T23:59:59.999Z'),
      },
    ];

    expect(isOnPlannedAbsence(absences, new Date('2026-06-15T12:00:00.000Z'))).toBe(true);
  });

  it('retorna false quando scheduled no futuro', () => {
    const absences = [
      {
        status: 'scheduled' as const,
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        endDate: new Date('2026-07-15T23:59:59.999Z'),
      },
    ];

    expect(isOnPlannedAbsence(absences, new Date('2026-06-15T12:00:00.000Z'))).toBe(false);
  });
});
