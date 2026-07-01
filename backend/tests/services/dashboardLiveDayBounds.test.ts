import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const discordMocks = vi.hoisted(() => ({
  guildsCache: new Map<
    string,
    {
      id: string;
      name: string;
      members: {
        cache: Map<
          string,
          {
            id: string;
            user: { bot: boolean; username: string; globalName?: string };
            displayName: string;
            presence?: { status: string };
            voice: { channelId: string | null; channel?: { name: string } | null };
          }
        >;
      };
    }
  >(),
}));

const voiceMocks = vi.hoisted(() => ({
  findAllOpen: vi.fn(),
  sumTodayByUserIds: vi.fn(),
}));

const presenceMocks = vi.hoisted(() => ({
  findAllOpen: vi.fn(),
  sumTodayOnlineByUserIds: vi.fn(),
}));

const transitionMocks = vi.hoisted(() => ({
  findSinceByGuild: vi.fn(),
  findRecentByGuild: vi.fn(),
}));

const userFindMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/db/models/Organization', () => ({
  OrganizationModel: {
    findById: () => ({
      select: () => ({
        lean: () => ({
          exec: async () => ({ settings: { timezone: 'America/Sao_Paulo' } }),
        }),
      }),
    }),
  },
}));

vi.mock('../../src/bot/client', () => ({
  discordClient: {
    guilds: {
      cache: discordMocks.guildsCache,
      fetch: vi.fn(),
    },
  },
}));

vi.mock('../../src/repositories/voiceSessionRepository', () => ({
  voiceSessionRepository: {
    findAllOpen: voiceMocks.findAllOpen,
    sumTodayByUserIds: voiceMocks.sumTodayByUserIds,
  },
}));

vi.mock('../../src/repositories/presenceSessionRepository', () => ({
  presenceSessionRepository: {
    findAllOpen: presenceMocks.findAllOpen,
    sumTodayOnlineByUserIds: presenceMocks.sumTodayOnlineByUserIds,
  },
}));

vi.mock('../../src/repositories/voiceChannelTransitionRepository', () => ({
  voiceChannelTransitionRepository: {
    findSinceByGuild: transitionMocks.findSinceByGuild,
    findRecentByGuild: transitionMocks.findRecentByGuild,
  },
}));

vi.mock('../../src/db/models/User', () => ({
  User: {
    find: userFindMock,
  },
}));

import { buildGuildLiveDashboardOnBotInstance } from '../../src/services/dashboardLiveService';
import { getDayBounds } from '../../src/utils/timezone';

const ORG_ID = '507f1f77bcf86cd799439011';

/**
 * Configura guild e usuário mínimos para testes do snapshot ao vivo.
 */
function seedGuildWithMember(discordId: string, displayName: string): void {
  discordMocks.guildsCache.set('guild-1', {
    id: 'guild-1',
    name: 'eCondos',
    members: {
      cache: new Map([
        [
          discordId,
          {
            id: discordId,
            user: { bot: false, username: displayName.toLowerCase() },
            displayName,
            presence: { status: 'online' },
            voice: { channelId: 'v1', channel: { name: 'Reunião' } },
          },
        ],
      ]),
    },
  });

  userFindMock.mockReturnValue({
    select: () => ({
      lean: async () => [{ _id: 'mongo-user-1', discordId }],
    }),
  });
}

describe('buildGuildLiveDashboardOnBotInstance — dia civil e consistência', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-01T12:00:00.000Z'));

    voiceMocks.findAllOpen.mockResolvedValue([]);
    presenceMocks.findAllOpen.mockResolvedValue([]);
    transitionMocks.findSinceByGuild.mockResolvedValue([]);
    transitionMocks.findRecentByGuild.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    discordMocks.guildsCache.clear();
    vi.clearAllMocks();
  });

  it('exige organizationId para evitar totais sem escopo de tenant', async () => {
    await expect(buildGuildLiveDashboardOnBotInstance('guild-1')).rejects.toThrow(/organizationId é obrigatório/);
  });

  it('passa dayStart do dia civil da organização aos repositórios', async () => {
    seedGuildWithMember('u-1', 'Ana');
    const expectedDayStart = getDayBounds(new Date('2026-07-01T12:00:00.000Z'), 'America/Sao_Paulo').start;

    voiceMocks.sumTodayByUserIds.mockResolvedValue(new Map([['mongo-user-1', { collaborationSeconds: 100, inactiveSeconds: 0 }]]));
    presenceMocks.sumTodayOnlineByUserIds.mockResolvedValue(new Map([['mongo-user-1', 100]]));

    await buildGuildLiveDashboardOnBotInstance('guild-1', ORG_ID);

    expect(voiceMocks.sumTodayByUserIds).toHaveBeenCalledWith(
      ['mongo-user-1'],
      expect.anything(),
      'guild-1',
      expectedDayStart,
      new Date('2026-07-01T12:00:00.000Z'),
    );
    expect(presenceMocks.sumTodayOnlineByUserIds).toHaveBeenCalledWith(
      ['mongo-user-1'],
      expect.anything(),
      'guild-1',
      expectedDayStart,
      new Date('2026-07-01T12:00:00.000Z'),
    );
  });

  it('limita totais ao tempo máximo possível no dia civil (não semana/mês)', async () => {
    seedGuildWithMember('u-1', 'Ana');
    const timezone = 'America/Sao_Paulo';
    const now = new Date('2026-07-01T12:00:00.000Z');
    const { start: dayStart } = getDayBounds(now, timezone);
    const maxSeconds = Math.floor((now.getTime() - dayStart.getTime()) / 1000);

    voiceMocks.sumTodayByUserIds.mockResolvedValue(
      new Map([['mongo-user-1', { collaborationSeconds: 500_000, inactiveSeconds: 400_000 }]]),
    );
    presenceMocks.sumTodayOnlineByUserIds.mockResolvedValue(new Map([['mongo-user-1', 600_000]]));

    const snapshot = await buildGuildLiveDashboardOnBotInstance('guild-1', ORG_ID);
    const member = snapshot.onlineRanking[0];

    expect(snapshot.dayDate).toBe('2026-07-01');
    expect(snapshot.timezone).toBe(timezone);
    expect(member?.collaborationActiveSeconds).toBe(maxSeconds);
    expect(member?.onlineSeconds).toBe(maxSeconds);
    expect(member?.inactiveSeconds).toBe(maxSeconds);
  });

  it('produz snapshots idênticos em chamadas consecutivas com os mesmos dados', async () => {
    seedGuildWithMember('u-1', 'Ana');

    voiceMocks.sumTodayByUserIds.mockResolvedValue(
      new Map([['mongo-user-1', { collaborationSeconds: 3600, inactiveSeconds: 0 }]]),
    );
    presenceMocks.sumTodayOnlineByUserIds.mockResolvedValue(new Map([['mongo-user-1', 7200]]));

    const first = await buildGuildLiveDashboardOnBotInstance('guild-1', ORG_ID);
    const second = await buildGuildLiveDashboardOnBotInstance('guild-1', ORG_ID);

    expect(first.onlineRanking).toEqual(second.onlineRanking);
    expect(first.activeMembers).toEqual(second.activeMembers);
    expect(first.dayDate).toBe(second.dayDate);
  });
});
