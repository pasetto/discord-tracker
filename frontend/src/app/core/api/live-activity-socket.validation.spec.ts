import { isValidLiveDashboardSnapshot } from './live-activity-socket.service';

describe('isValidLiveDashboardSnapshot', () => {
  const base = {
    generatedAt: '2026-07-01T12:00:00.000Z',
    dayDate: '2026-07-01',
    timezone: 'America/Sao_Paulo',
    guildId: 'g1',
    guildName: 'Test',
    activeCount: 1,
    activeMembers: [],
    onlineRanking: [],
    recentTransitions: [],
  };

  it('aceita snapshot diário válido', () => {
    expect(
      isValidLiveDashboardSnapshot({
        ...base,
        onlineRanking: [
          {
            discordId: '1',
            displayName: 'Ana',
            status: 'ONLINE',
            voiceChannelId: null,
            voiceChannelName: null,
            onlineSeconds: 3600,
            onlineSince: null,
            collaborationActiveSeconds: 1800,
            inactiveSeconds: 0,
            isCollaborationActive: false,
            inIgnoredChannel: false,
            voiceSessionType: null,
            channelsVisitedToday: [],
          },
        ],
      }),
    ).toBe(true);
  });

  it('rejeita snapshot sem dayDate (worker legado)', () => {
    expect(isValidLiveDashboardSnapshot({ ...base, dayDate: '' })).toBe(false);
  });

  it('rejeita totais acima de 24h (snapshot acumulado incorreto)', () => {
    expect(
      isValidLiveDashboardSnapshot({
        ...base,
        onlineRanking: [
          {
            discordId: '1',
            displayName: 'Ana',
            status: 'ONLINE',
            voiceChannelId: null,
            voiceChannelName: null,
            onlineSeconds: 300_000,
            onlineSince: null,
            collaborationActiveSeconds: 100_000,
            inactiveSeconds: 0,
            isCollaborationActive: false,
            inIgnoredChannel: false,
            voiceSessionType: null,
            channelsVisitedToday: [],
          },
        ],
      }),
    ).toBe(false);
  });
});
