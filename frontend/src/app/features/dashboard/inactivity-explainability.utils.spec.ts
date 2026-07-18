import {
  formatAbsenceWindow,
  getAbsenceTypeLabel,
  getIntradayExplainabilityLabel,
  getNonConcernExplainabilityEntries,
  type IntradayExplainabilityEntry,
} from './inactivity-explainability.utils';

describe('inactivity-explainability.utils', () => {
  it('rotula tipos de ausência em pt-BR', () => {
    expect(getAbsenceTypeLabel('pto')).toBe('PTO');
    expect(getAbsenceTypeLabel('vacation')).toBe('Férias');
    expect(getAbsenceTypeLabel('sick_leave')).toBe('Atestado');
    expect(getAbsenceTypeLabel('other')).toBe('Outra ausência');
  });

  it('formata janela de ausência quando há datas', () => {
    expect(
      formatAbsenceWindow({
        startDate: '2026-07-10T00:00:00.000Z',
        endDate: '2026-07-20T23:59:59.000Z',
      }),
    ).toBe('10/07/2026 – 20/07/2026');
  });

  it('explica status de não-concern em linguagem legível', () => {
    expect(getIntradayExplainabilityLabel('outside_work_day')).toBe(
      'Fora do dia útil / feriado — não conta como “sumiu”',
    );
    expect(getIntradayExplainabilityLabel('outside_work_hours')).toBe(
      'Fora da jornada configurada — ainda cedo demais para alerta',
    );
    expect(
      getIntradayExplainabilityLabel('on_planned_absence', {
        type: 'pto',
        startDate: '2026-07-10T00:00:00.000Z',
        endDate: '2026-07-20T23:59:59.000Z',
      }),
    ).toBe('Ausência planejada (PTO) · 10/07/2026 – 20/07/2026');
  });

  it('filtra entradas de explicabilidade (não-concern)', () => {
    const entries: IntradayExplainabilityEntry[] = [
      {
        trackedUserId: '1',
        discordId: 'a',
        displayName: 'Ana',
        status: 'not_started',
      },
      {
        trackedUserId: '2',
        discordId: 'b',
        displayName: 'Bruno',
        status: 'outside_work_hours',
      },
      {
        trackedUserId: '3',
        discordId: 'c',
        displayName: 'Carla',
        status: 'on_planned_absence',
        plannedAbsence: {
          type: 'vacation',
          startDate: '2026-07-01T00:00:00.000Z',
          endDate: '2026-07-15T00:00:00.000Z',
        },
      },
      {
        trackedUserId: '4',
        discordId: 'd',
        displayName: 'Diego',
        status: 'ok',
      },
    ];

    const explained = getNonConcernExplainabilityEntries(entries);
    expect(explained.map((entry) => entry.displayName)).toEqual(['Bruno', 'Carla']);
    expect(explained[1].message).toContain('Férias');
  });
});
