import { describe, expect, it, vi } from 'vitest';



const discordMocks = vi.hoisted(() => ({

  ensureDiscordGuildAccessible: vi.fn(async () => true),

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



vi.mock('../../src/bot/client', () => ({

  ensureDiscordGuildAccessible: discordMocks.ensureDiscordGuildAccessible,

  discordClient: {

    guilds: {

      cache: discordMocks.guildsCache,

    },

  },

}));



const voiceMocks = vi.hoisted(() => ({

  findAllOpen: vi.fn(),

  sumTodayByUserIds: vi.fn(),

}));



vi.mock('../../src/repositories/voiceSessionRepository', () => ({

  voiceSessionRepository: {

    findAllOpen: voiceMocks.findAllOpen,

    sumTodayByUserIds: voiceMocks.sumTodayByUserIds,

  },

}));



const transitionMocks = vi.hoisted(() => ({

  findSinceByGuild: vi.fn(),

  findRecentByGuild: vi.fn(),

}));



vi.mock('../../src/repositories/voiceChannelTransitionRepository', () => ({

  voiceChannelTransitionRepository: {

    findSinceByGuild: transitionMocks.findSinceByGuild,

    findRecentByGuild: transitionMocks.findRecentByGuild,

  },

}));



const presenceMocks = vi.hoisted(() => ({

  findAllOpen: vi.fn(),

  sumTodayOnlineByUserIds: vi.fn(),

}));



vi.mock('../../src/repositories/presenceSessionRepository', () => ({

  presenceSessionRepository: {

    findAllOpen: presenceMocks.findAllOpen,

    sumTodayOnlineByUserIds: presenceMocks.sumTodayOnlineByUserIds,

  },

}));



const userFindMock = vi.hoisted(() => vi.fn());



vi.mock('../../src/db/models/User', () => ({

  User: {

    find: userFindMock,

  },

}));



import { getGuildLiveDashboard } from '../../src/services/dashboardLiveService';



describe('getGuildLiveDashboard', () => {

  it('retorna membros ativos e ranking por colaboração acumulada hoje', async () => {

    discordMocks.ensureDiscordGuildAccessible.mockResolvedValue(true);

    discordMocks.guildsCache.set('guild-1', {

      id: 'guild-1',

      name: 'eCondos',

      members: {

        cache: new Map([

          [

            'u-long',

            {

              id: 'u-long',

              user: { bot: false, username: 'long' },

              displayName: 'Ana Longa',

              presence: { status: 'online' },

              voice: { channelId: 'v1', channel: { name: 'Reunião' } },

            },

          ],

          [

            'u-short',

            {

              id: 'u-short',

              user: { bot: false, username: 'short' },

              displayName: 'Bruno Curto',

              presence: { status: 'offline' },

              voice: { channelId: null, channel: null },

            },

          ],

        ]),

      },

    });



    userFindMock.mockReturnValue({

      select: () => ({

        lean: async () => [

          { _id: 'mongo-long', discordId: 'u-long' },

          { _id: 'mongo-short', discordId: 'u-short' },

        ],

      }),

    });



    const startedAtLong = new Date(Date.now() - 7200_000);



    presenceMocks.findAllOpen.mockResolvedValue([

      { userId: 'mongo-long', status: 'ONLINE', startedAt: startedAtLong },

    ]);

    voiceMocks.findAllOpen.mockResolvedValue([

      {

        userId: 'mongo-long',

        startedAt: startedAtLong,

        isIgnoredChannel: false,

        sessionType: 'VOICE',

      },

    ]);

    voiceMocks.sumTodayByUserIds.mockResolvedValue(

      new Map([

        ['mongo-long', { collaborationSeconds: 5400, inactiveSeconds: 0 }],

        ['mongo-short', { collaborationSeconds: 900, inactiveSeconds: 120 }],

      ]),

    );

    presenceMocks.sumTodayOnlineByUserIds.mockResolvedValue(

      new Map([

        ['mongo-long', 7200],

        ['mongo-short', 900],

      ]),

    );

    transitionMocks.findSinceByGuild.mockResolvedValue([]);

    transitionMocks.findRecentByGuild.mockResolvedValue([]);



    const snapshot = await getGuildLiveDashboard('guild-1', '507f1f77bcf86cd799439011');



    expect(snapshot.guildName).toBe('eCondos');

    expect(snapshot.activeCount).toBe(1);

    expect(snapshot.activeMembers[0]?.collaborationActiveSeconds).toBe(5400);

    expect(snapshot.onlineRanking[0]?.discordId).toBe('u-long');

    expect(snapshot.onlineRanking[1]?.discordId).toBe('u-short');

    expect(snapshot.recentTransitions).toEqual([]);

  });

  it('falha quando o bot não fica acessível mesmo após o retry', async () => {

    discordMocks.ensureDiscordGuildAccessible.mockResolvedValue(false);

    await expect(getGuildLiveDashboard('guild-1', '507f1f77bcf86cd799439011')).rejects.toThrow(

      /Bot Discord não conectado/,

    );

    discordMocks.ensureDiscordGuildAccessible.mockResolvedValue(true);

  });

});

