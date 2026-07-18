import {
  buildAttentionItems,
  buildFirstValueChecklistItems,
  countWeeklyMissingEntries,
  formatTimelineEventLabel,
  mapOverviewDailyChart,
  mapOverviewHeatmapCells,
  resolveDashboardFirstName,
  resolveDashboardGreeting,
  sanitizeDiscordDisplayName,
  shouldShowFirstValueChecklist,
} from './dashboard.utils';

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

    const chart = mapOverviewDailyChart(
      [
        { date: '2026-07-01', collaborationHours: 4, voiceHours: 5 },
        { date: '2026-07-02', collaborationHours: 6, voiceHours: 7 },
      ],
      8,
    );

    expect(chart.points.length).toBe(2);
    expect(chart.points[1].hours).toBe(8);
    expect(chart.points[1].isToday).toBeTrue();
  });

  it('formata transições de voz com origem e destino', () => {
    expect(formatTimelineEventLabel('JOIN', 'Ana', { toChannelName: 'Squad Backend' })).toBe(
      'Ana entrou em Squad Backend',
    );

    expect(formatTimelineEventLabel('LEAVE', 'Ana', { fromChannelName: 'Squad Backend' })).toBe(
      'Ana saiu de Squad Backend',
    );

    expect(
      formatTimelineEventLabel('SWITCH', 'Ana', {
        fromChannelName: 'Geral',
        toChannelName: 'Daily',
      }),
    ).toBe('Ana foi de Geral para Daily');

    expect(sanitizeDiscordDisplayName('*Camila Bueno*')).toBe('Camila Bueno');
  });

  it('exibe empty-state de primeiro valor só após onboarding e sem alertas', () => {
    expect(
      shouldShowFirstValueChecklist({
        onboardingComplete: true,
        concernEntriesCount: 0,
        missingEntriesCount: 0,
      }),
    ).toBeTrue();

    expect(
      shouldShowFirstValueChecklist({
        onboardingComplete: false,
        concernEntriesCount: 0,
        missingEntriesCount: 0,
      }),
    ).toBeFalse();

    expect(
      shouldShowFirstValueChecklist({
        onboardingComplete: true,
        concernEntriesCount: 1,
        missingEntriesCount: 0,
      }),
    ).toBeFalse();

    expect(
      shouldShowFirstValueChecklist({
        onboardingComplete: true,
        concernEntriesCount: 0,
        missingEntriesCount: 2,
      }),
    ).toBeFalse();
  });

  it('monta checklist pós-onboarding com deep links e sem produtividade', () => {
    const items = buildFirstValueChecklistItems({
      channelsConfigured: true,
      calendarConfigured: false,
      pushEnabled: false,
      isBusinessDay: true,
    });

    expect(items.map((item) => item.id)).toEqual([
      'channels',
      'calendar',
      'pto',
      'push',
      'business-day',
    ]);
    expect(items.find((item) => item.id === 'channels')?.actionRoute).toBe('/app/settings/channels');
    expect(items.find((item) => item.id === 'calendar')?.actionRoute).toBe('/app/settings/calendar');
    expect(items.find((item) => item.id === 'pto')?.actionRoute).toBe('/app/settings/absences');
    expect(items.find((item) => item.id === 'push')?.actionRoute).toBe('/app/settings/inactivity');
    expect(items.find((item) => item.id === 'channels')?.done).toBeTrue();
    expect(items.find((item) => item.id === 'calendar')?.done).toBeFalse();

    const joined = items.map((item) => `${item.title} ${item.description}`).join(' ').toLowerCase();
    expect(joined).not.toContain('produtividade');
    expect(joined).not.toContain('produtivo');
  });

  it('marca PTO como concluído mesmo sem ausências cadastradas (não bloqueia checklist saudável)', () => {
    const items = buildFirstValueChecklistItems({
      channelsConfigured: true,
      calendarConfigured: true,
      pushEnabled: true,
      isBusinessDay: true,
    });

    const pto = items.find((item) => item.id === 'pto');
    expect(pto?.done).toBeTrue();
    expect(pto?.actionRoute).toBe('/app/settings/absences');
    expect(pto?.description.toLowerCase()).toContain('quando alguém');
    expect(items.every((item) => item.done)).toBeTrue();
  });

  it('conta apenas entradas semanais missing', () => {
    expect(
      countWeeklyMissingEntries([
        { displayName: 'Ana', status: 'missing' },
        { displayName: 'Bruno', status: 'low_voice_collaboration' },
        { displayName: 'Carla', status: 'active' },
      ]),
    ).toBe(1);
  });
});
