import { describe, expect, it } from 'vitest';
import {
  computeIntradayInactivityStatus,
  resolveActivePlannedAbsenceRef,
  type ComputeIntradayInactivityInput,
} from '../../src/services/intradayInactivityService';

const defaultSettings = {
  lateStartThresholdPercent: 30,
  minCollaborationPercentOfElapsed: 20,
};

/**
 * Cria input base para testes de inatividade intradiária.
 * @param overrides Sobrescritas pontuais
 * @returns Input completo
 */
function createInput(overrides: Partial<ComputeIntradayInactivityInput> = {}): ComputeIntradayInactivityInput {
  return {
    settings: defaultSettings,
    onPlannedAbsence: false,
    isBusinessDay: true,
    elapsedPercent: 40,
    elapsedWorkSeconds: 3600,
    hasAppearedToday: false,
    collaborationSecondsInWorkWindow: 0,
    ...overrides,
  };
}

describe('computeIntradayInactivityStatus', () => {
  it('retorna on_planned_absence quando colaborador está em PTO', () => {
    const result = computeIntradayInactivityStatus(
      createInput({ onPlannedAbsence: true, elapsedPercent: 50 }),
    );

    expect(result).toBe('on_planned_absence');
  });

  it('retorna outside_work_day em dia não útil', () => {
    const result = computeIntradayInactivityStatus(createInput({ isBusinessDay: false }));

    expect(result).toBe('outside_work_day');
  });

  it('retorna outside_work_hours antes do percentual mínimo da jornada', () => {
    const result = computeIntradayInactivityStatus(
      createInput({ elapsedPercent: 10, hasAppearedToday: false }),
    );

    expect(result).toBe('outside_work_hours');
  });

  it('retorna not_started quando não apareceu após limiar de início tardio', () => {
    const result = computeIntradayInactivityStatus(
      createInput({ elapsedPercent: 35, hasAppearedToday: false }),
    );

    expect(result).toBe('not_started');
  });

  it('retorna low_collaboration_today quando colaboração está abaixo do mínimo', () => {
    const result = computeIntradayInactivityStatus(
      createInput({
        elapsedPercent: 50,
        elapsedWorkSeconds: 3600,
        hasAppearedToday: true,
        collaborationSecondsInWorkWindow: 600,
      }),
    );

    expect(result).toBe('low_collaboration_today');
  });

  it('retorna ok quando colaboração atende o mínimo esperado', () => {
    const result = computeIntradayInactivityStatus(
      createInput({
        elapsedPercent: 50,
        elapsedWorkSeconds: 3600,
        hasAppearedToday: true,
        collaborationSecondsInWorkWindow: 900,
      }),
    );

    expect(result).toBe('ok');
  });
});

describe('resolveActivePlannedAbsenceRef', () => {
  it('retorna tipo e janela da ausência ativa no instante', () => {
    const result = resolveActivePlannedAbsenceRef(
      [
        {
          type: 'pto',
          status: 'active',
          startDate: new Date('2026-07-10T00:00:00.000Z'),
          endDate: new Date('2026-07-20T23:59:59.000Z'),
        },
      ],
      new Date('2026-07-18T12:00:00.000Z'),
    );

    expect(result).toEqual({
      type: 'pto',
      startDate: new Date('2026-07-10T00:00:00.000Z'),
      endDate: new Date('2026-07-20T23:59:59.000Z'),
    });
  });

  it('retorna undefined quando não há ausência cobrindo a data', () => {
    const result = resolveActivePlannedAbsenceRef(
      [
        {
          type: 'vacation',
          status: 'scheduled',
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          endDate: new Date('2026-08-10T23:59:59.000Z'),
        },
      ],
      new Date('2026-07-18T12:00:00.000Z'),
    );

    expect(result).toBeUndefined();
  });
});
