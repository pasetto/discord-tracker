import { describe, expect, it } from 'vitest';
import {
  computeBusinessDaysBetween,
  computeInactivityStatus,
  applyReturnedStatus,
  type ComputeInactivityStatusInput,
} from '../../src/services/inactivityService';
import type { WorkCalendar } from '../../src/db/models/WorkCalendar';

const defaultSettings = {
  inactiveAfterBusinessDays: 2,
  zeroVoiceCollaborationDays: 3,
  notifyManagerPush: true,
  notifyManagerEmail: false,
};

/**
 * Cria input base para testes do cálculo de status de inatividade.
 * @param overrides Sobrescritas pontuais para o cenário testado
 * @returns Input completo para computeInactivityStatus
 */
function createInput(overrides: Partial<ComputeInactivityStatusInput> = {}): ComputeInactivityStatusInput {
  return {
    settings: defaultSettings,
    businessDaysInactive: 0,
    onPlannedAbsence: false,
    hasRecentText: false,
    hasRecentPresence: false,
    zeroVoiceDays: 0,
    ...overrides,
  };
}

describe('computeInactivityStatus', () => {
  it('retorna on_planned_absence quando membro está em PTO', () => {
    const result = computeInactivityStatus(
      createInput({
        businessDaysInactive: 5,
        onPlannedAbsence: true,
        hasRecentText: false,
        hasRecentPresence: false,
        zeroVoiceDays: 5,
      }),
    );

    expect(result).toBe('on_planned_absence');
  });

  it('retorna missing após N dias úteis sem sinais', () => {
    const result = computeInactivityStatus(
      createInput({
        businessDaysInactive: 2,
        onPlannedAbsence: false,
        hasRecentText: false,
        hasRecentPresence: false,
        zeroVoiceDays: 2,
      }),
    );

    expect(result).toBe('missing');
  });

  it('retorna low_voice_collaboration quando há presença recente sem voz suficiente', () => {
    const result = computeInactivityStatus(
      createInput({
        businessDaysInactive: 0,
        hasRecentText: true,
        hasRecentPresence: true,
        zeroVoiceDays: 3,
      }),
    );

    expect(result).toBe('low_voice_collaboration');
  });

  it('retorna active quando status não é missing e não é low_voice_collaboration', () => {
    const result = computeInactivityStatus(
      createInput({
        businessDaysInactive: 1,
        hasRecentText: true,
        hasRecentPresence: true,
        zeroVoiceDays: 1,
      }),
    );

    expect(result).toBe('active');
  });
});

describe('applyReturnedStatus', () => {
  it('retorna returned quando membro estava missing e voltou', () => {
    expect(applyReturnedStatus('active', 'missing')).toBe('returned');
    expect(applyReturnedStatus('low_voice_collaboration', 'missing')).toBe('returned');
  });

  it('preserva status quando não houve retorno', () => {
    expect(applyReturnedStatus('missing', 'missing')).toBe('missing');
    expect(applyReturnedStatus('active', 'active')).toBe('active');
    expect(applyReturnedStatus('active', undefined)).toBe('active');
  });
});

describe('computeBusinessDaysBetween', () => {
  const calendar: Pick<WorkCalendar, 'workWeek' | 'holidays'> = {
    workWeek: {
      monday: { enabled: true, startTime: '09:00', endTime: '18:00' },
      tuesday: { enabled: true, startTime: '09:00', endTime: '18:00' },
      wednesday: { enabled: true, startTime: '09:00', endTime: '18:00' },
      thursday: { enabled: true, startTime: '09:00', endTime: '18:00' },
      friday: { enabled: true, startTime: '09:00', endTime: '18:00' },
      saturday: { enabled: false },
      sunday: { enabled: false },
    },
    holidays: [{ date: '2026-06-04', name: 'Feriado local', type: 'company_custom' }],
  };

  it('conta somente dias úteis entre duas datas em UTC', () => {
    const result = computeBusinessDaysBetween({
      calendar,
      from: new Date('2026-06-01T10:00:00.000Z'),
      to: new Date('2026-06-08T10:00:00.000Z'),
      isOnPlannedAbsenceAt: () => false,
    });

    expect(result).toBe(4);
  });

  it('ignora dias cobertos por ausência planejada', () => {
    const result = computeBusinessDaysBetween({
      calendar,
      from: new Date('2026-06-01T10:00:00.000Z'),
      to: new Date('2026-06-05T10:00:00.000Z'),
      isOnPlannedAbsenceAt: (date) => date.toISOString().startsWith('2026-06-03'),
    });

    expect(result).toBe(2);
  });
});
