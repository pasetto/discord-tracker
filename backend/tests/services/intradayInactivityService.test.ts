import { describe, expect, it } from 'vitest';
import {
  computeIntradayInactivityStatus,
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
