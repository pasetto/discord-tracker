import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clusterMocks = vi.hoisted(() => ({
  shouldRunBackgroundJobs: vi.fn(() => false),
  isDiscordBotInstanceReachable: vi.fn(async () => true),
  callInternalDiscordApi: vi.fn(),
  checkDiscordHealth: vi.fn(() => true),
  guildsCache: new Map<string, { id: string; name: string; memberCount: number; icon: string | null }>(),
}));

vi.mock('../../src/runtime/clusterRole', () => ({
  shouldRunBackgroundJobs: clusterMocks.shouldRunBackgroundJobs,
}));

vi.mock('../../src/services/discordClusterProxy', () => ({
  isDiscordBotInstanceReachable: clusterMocks.isDiscordBotInstanceReachable,
  callInternalDiscordApi: clusterMocks.callInternalDiscordApi,
  DISCORD_NOT_CONNECTED_MESSAGE:
    'Bot Discord não conectado. Verifique a configuração em Configurações → Discord.',
}));

vi.mock('../../src/bot/client', () => ({
  checkDiscordHealth: clusterMocks.checkDiscordHealth,
  discordClient: {
    isReady: () => true,
    guilds: {
      cache: {
        values: () => clusterMocks.guildsCache.values(),
        get: (id: string) => clusterMocks.guildsCache.get(id),
        get size() {
          return clusterMocks.guildsCache.size;
        },
      },
      fetch: vi.fn(async (id: string) => {
        const guild = clusterMocks.guildsCache.get(id);
        if (!guild) {
          throw new Error('Unknown Guild');
        }
        return guild;
      }),
    },
  },
}));

import {
  getInstalledGuildSummary,
  listInstalledGuildSummaries,
  resolveInstalledGuildCount,
} from '../../src/services/discordInstalledGuildsService';

describe('discordInstalledGuildsService', () => {
  beforeEach(() => {
    clusterMocks.shouldRunBackgroundJobs.mockReturnValue(false);
    clusterMocks.isDiscordBotInstanceReachable.mockResolvedValue(true);
    clusterMocks.callInternalDiscordApi.mockReset();
    clusterMocks.guildsCache.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lista guilds via proxy interno em worker API-only', async () => {
    clusterMocks.callInternalDiscordApi.mockResolvedValue({
      guilds: [
        {
          guildId: 'g1',
          guildName: 'Piloto',
          memberCount: 3,
          iconUrl: 'https://cdn.discordapp.com/icons/g1/abc.png',
        },
      ],
    });

    const guilds = await listInstalledGuildSummaries();

    expect(guilds).toEqual([
      {
        guildId: 'g1',
        guildName: 'Piloto',
        memberCount: 3,
        iconUrl: 'https://cdn.discordapp.com/icons/g1/abc.png',
      },
    ]);
    expect(clusterMocks.callInternalDiscordApi).toHaveBeenCalledWith('/internal/discord/guilds');
  });

  it('resolve guildCount via health interno em worker API-only', async () => {
    clusterMocks.callInternalDiscordApi.mockResolvedValue({
      discordConnected: true,
      guildCount: 2,
    });

    await expect(resolveInstalledGuildCount()).resolves.toBe(2);
    expect(clusterMocks.callInternalDiscordApi).toHaveBeenCalledWith('/internal/discord/health');
  });

  it('busca guild por id via proxy interno em worker API-only', async () => {
    clusterMocks.callInternalDiscordApi.mockResolvedValue({
      guild: {
        guildId: 'g9',
        guildName: 'QA',
        memberCount: 1,
        iconUrl: undefined,
      },
    });

    const guild = await getInstalledGuildSummary('g9');

    expect(guild).toEqual({
      guildId: 'g9',
      guildName: 'QA',
      memberCount: 1,
      iconUrl: undefined,
    });
    expect(clusterMocks.callInternalDiscordApi).toHaveBeenCalledWith('/internal/discord/guilds/g9');
  });

  it('lista guilds localmente na instância bot quando interno indisponível', async () => {
    clusterMocks.shouldRunBackgroundJobs.mockReturnValue(true);
    clusterMocks.isDiscordBotInstanceReachable.mockResolvedValue(false);
    clusterMocks.guildsCache.set('local-1', {
      id: 'local-1',
      name: 'Local Guild',
      memberCount: 5,
      icon: 'iconhash',
    });

    const guilds = await listInstalledGuildSummaries();

    expect(guilds).toEqual([
      {
        guildId: 'local-1',
        guildName: 'Local Guild',
        memberCount: 5,
        iconUrl: 'https://cdn.discordapp.com/icons/local-1/iconhash.png',
      },
    ]);
    expect(clusterMocks.callInternalDiscordApi).not.toHaveBeenCalled();
  });
});
