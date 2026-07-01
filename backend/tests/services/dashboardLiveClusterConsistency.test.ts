import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Valida que snapshots REST e internos convergem no mesmo resultado em cluster PM2.
 */
describe('consistência cluster PM2 — dashboard ao vivo', () => {
  const clusterMocks = vi.hoisted(() => ({
    shouldRunBackgroundJobs: vi.fn(() => false),
    isPm2ClusterWorker: vi.fn(() => true),
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

  const originalFetch = global.fetch;

  beforeEach(() => {
    clusterMocks.shouldRunBackgroundJobs.mockReturnValue(false);
    clusterMocks.isPm2ClusterWorker.mockReturnValue(true);
    delete process.env.INTERNAL_DISCORD_PORT;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('worker API-only e instância bot em cluster usam o mesmo endpoint interno', async () => {
    const { runWithDiscordBot } = await import('../../src/services/discordClusterProxy');

    const internalSnapshot = {
      dayDate: '2026-07-01',
      timezone: 'America/Sao_Paulo',
      onlineRanking: [{ discordId: 'u-1', onlineSeconds: 3600, collaborationActiveSeconds: 1800 }],
    };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ discordConnected: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => internalSnapshot,
      }) as typeof fetch;

    const apiWorkerResult = await runWithDiscordBot({
      guildId: 'guild-1',
      internalPath: '/internal/discord/guilds/guild-1/live-dashboard?organizationId=org-1',
      onBotInstance: async () => ({ stale: true }),
    });

    expect(apiWorkerResult).toEqual(internalSnapshot);
    expect(clusterMocks.ensureDiscordGuildAccessible).not.toHaveBeenCalled();

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ discordConnected: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => internalSnapshot,
      }) as typeof fetch;

    clusterMocks.shouldRunBackgroundJobs.mockReturnValue(true);

    const botInstanceResult = await runWithDiscordBot({
      guildId: 'guild-1',
      internalPath: '/internal/discord/guilds/guild-1/live-dashboard?organizationId=org-1',
      onBotInstance: async () => ({ stale: true }),
    });

    expect(botInstanceResult).toEqual(internalSnapshot);
    expect(clusterMocks.ensureDiscordGuildAccessible).not.toHaveBeenCalled();
  });
});
