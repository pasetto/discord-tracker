import { buildAttentionItems, resolveDashboardFirstName, resolveDashboardGreeting } from './dashboard.utils';

describe('dashboard.utils', () => {
  it('resolve saudação por horário', () => {
    expect(resolveDashboardGreeting(new Date('2026-07-02T09:00:00'))).toBe('Bom dia');
    expect(resolveDashboardGreeting(new Date('2026-07-02T14:00:00'))).toBe('Boa tarde');
    expect(resolveDashboardGreeting(new Date('2026-07-02T20:00:00'))).toBe('Boa noite');
  });

  it('extrai primeiro nome do usuário', () => {
    expect(resolveDashboardFirstName('Eduardo Pereira')).toBe('Eduardo');
    expect(resolveDashboardFirstName('')).toBe('Gestor');
  });

  it('monta lista de atenção priorizando alertas críticos', () => {
    const items = buildAttentionItems(
      [
        {
          trackedUserId: '1',
          discordId: 'd1',
          displayName: 'Ana',
          status: 'not_started',
          elapsedWorkPercent: 30,
          collaborationPercentOfElapsed: 0,
          collaborationSecondsInWorkWindow: 0,
          elapsedWorkSeconds: 1000,
          hasAppearedToday: false,
        },
      ],
      [
        {
          trackedUserId: '2',
          discordId: 'd2',
          displayName: 'Bruno',
          status: 'missing',
          inactiveBusinessDays: 2,
        },
      ],
      [
        {
          trackedUserId: '3',
          discordId: 'd3',
          displayName: 'Carla',
          realizedHours: 2,
          progressPercent: 40,
          shouldAlertLowProgress: true,
        },
      ],
    );

    expect(items.length).toBe(3);
    expect(items[0].severity).toBe('critical');
    expect(items[0].displayName).toBe('Ana');
  });
});
