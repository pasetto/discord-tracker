import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clusterMocks = vi.hoisted(() => ({
  shouldRunBackgroundJobs: vi.fn(() => true),
  isPm2ClusterWorker: vi.fn(() => false),
  ensureDiscordGuildAccessible: vi.fn(async () => true),
}));

vi.mock('../../src/runtime/clusterRole', () => ({
  shouldRunBackgroundJobs: clusterMocks.shouldRunBackgroundJobs,
  isPm2ClusterWorker: clusterMocks.isPm2ClusterWorker,
}));

vi.mock('../../src/bot/client', () => ({
  ensureDiscordGuildAccessible: clusterMocks.ensureDiscordGuildAccessible,
}));

vi.mock('../../src/config/env', () => ({
  config: {
    port: 3000,
    apiKeys: ['test-internal-key'],
  },
}));

import {
  callInternalDiscordApi,
  getInternalDiscordPort,
  isDiscordBotInstanceReachable,
  runWithDiscordBot,
} from '../../src/services/discordClusterProxy';

describe('discordClusterProxy', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    clusterMocks.shouldRunBackgroundJobs.mockReturnValue(true);
    clusterMocks.isPm2ClusterWorker.mockReturnValue(false);
    clusterMocks.ensureDiscordGuildAccessible.mockResolvedValue(true);
    delete process.env.INTERNAL_DISCORD_PORT;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('usa porta interna derivada da porta HTTP por padrão', () => {
    expect(getInternalDiscordPort()).toBe(4000);
  });

  it('executa localmente na instância bot fora do cluster PM2', async () => {
    clusterMocks.isPm2ClusterWorker.mockReturnValue(false);
    const result = await runWithDiscordBot({
      guildId: 'guild-1',
      internalPath: '/internal/discord/guilds/guild-1/channels',
      onBotInstance: async () => ({ ok: true }),
    });

    expect(result).toEqual({ ok: true });
    expect(clusterMocks.ensureDiscordGuildAccessible).toHaveBeenCalledWith('guild-1');
  });

  it('instância bot em cluster PM2 também encaminha via servidor interno', async () => {
    clusterMocks.isPm2ClusterWorker.mockReturnValue(true);
    clusterMocks.shouldRunBackgroundJobs.mockReturnValue(true);
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ discordConnected: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      }) as typeof fetch;

    const result = await runWithDiscordBot({
      guildId: 'guild-1',
      internalPath: '/internal/discord/guilds/guild-1/live-dashboard',
      onBotInstance: async () => ({ stale: true }),
    });

    expect(result).toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(clusterMocks.ensureDiscordGuildAccessible).not.toHaveBeenCalled();
  });

  it('encaminha para servidor interno em worker API-only', async () => {
    clusterMocks.shouldRunBackgroundJobs.mockReturnValue(false);
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ discordConnected: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ channels: [{ channelId: '1' }] }),
      }) as typeof fetch;

    const result = await runWithDiscordBot({
      guildId: 'guild-1',
      internalPath: '/internal/discord/guilds/guild-1/channels',
      onBotInstance: async () => ({ channels: [] }),
    });

    expect(result).toEqual({ channels: [{ channelId: '1' }] });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('isDiscordBotInstanceReachable retorna false quando health interno falha', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as typeof fetch;

    await expect(isDiscordBotInstanceReachable()).resolves.toBe(false);
  });

  it('callInternalDiscordApi propaga erro do servidor interno', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Bot offline' }),
    }) as typeof fetch;

    await expect(callInternalDiscordApi('/internal/discord/health')).rejects.toThrow('Bot offline');
  });
});
