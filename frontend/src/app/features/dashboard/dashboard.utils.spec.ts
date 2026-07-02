import { buildAttentionItems, formatTimelineEventLabel, mapOverviewDailyChart, mapOverviewHeatmapCells, resolveDashboardFirstName, resolveDashboardGreeting, sanitizeDiscordDisplayName } from './dashboard.utils';

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

  it('mapeia overview histórico para heatmap e gráfico', () => {
    const heatmap = mapOverviewHeatmapCells([
      { dayIndex: 0, hour: 10, eventCount: 4 },
      { dayIndex: 1, hour: 10, eventCount: 2 },
    ]);
    expect(heatmap[0].intensity).toBe(1);
    expect(heatmap[1].intensity).toBe(0.5);

    const chart = mapOverviewDailyChart([
      { date: '2026-07-01', collaborationHours: 4, voiceHours: 5 },
      { date: '2026-07-02', collaborationHours: 6, voiceHours: 7 },
    ], 8);

    expect(chart.points.length).toBe(2);
    expect(chart.points[1].hours).toBe(8);
    expect(chart.points[1].isToday).toBeTrue();
  });

  it('formata transições de voz com origem e destino', () => {
    expect(
      formatTimelineEventLabel('JOIN', 'Ana', { toChannelName: 'Squad Backend' }),
    ).toBe('Ana entrou em Squad Backend');

    expect(
      formatTimelineEventLabel('LEAVE', 'Ana', { fromChannelName: 'Squad Backend' }),
    ).toBe('Ana saiu de Squad Backend');

    expect(
      formatTimelineEventLabel('SWITCH', 'Ana', {
        fromChannelName: 'Geral',
        toChannelName: 'Daily',
      }),
    ).toBe('Ana foi de Geral para Daily');

    expect(sanitizeDiscordDisplayName('*Camila Bueno*')).toBe('Camila Bueno');
  });
});
