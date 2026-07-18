import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const guildMocks = vi.hoisted(() => ({
  resolveDiscordBotConnected: vi.fn(async () => true),
  listInstalledGuildSummaries: vi.fn(),
  getInstalledGuildSummary: vi.fn(),
  resolveInstalledGuildCount: vi.fn(async () => 0),
  findConnections: vi.fn(),
  findOneConnection: vi.fn(),
  updateMany: vi.fn(),
  findOneAndUpdate: vi.fn(),
  setSelectedGuildId: vi.fn(),
}));

vi.mock('../../src/services/discordClusterProxy', () => ({
  resolveDiscordBotConnected: guildMocks.resolveDiscordBotConnected,
}));

vi.mock('../../src/services/discordInstalledGuildsService', () => ({
  listInstalledGuildSummaries: guildMocks.listInstalledGuildSummaries,
  getInstalledGuildSummary: guildMocks.getInstalledGuildSummary,
  resolveInstalledGuildCount: guildMocks.resolveInstalledGuildCount,
}));

vi.mock('../../src/db/models/GuildConnection', () => ({
  GuildConnectionModel: {
    find: (...args: unknown[]) => ({
      select: () => ({
        lean: () => ({
          exec: () => guildMocks.findConnections(...args),
        }),
      }),
    }),
    findOne: (...args: unknown[]) => ({
      lean: () => ({
        exec: () => guildMocks.findOneConnection(...args),
      }),
    }),
    updateMany: (...args: unknown[]) => guildMocks.updateMany(...args),
    findOneAndUpdate: (...args: unknown[]) => ({
      exec: () => guildMocks.findOneAndUpdate(...args),
    }),
  },
}));

vi.mock('../../src/services/guildService', () => ({
  guildService: {
    setSelectedGuildId: guildMocks.setSelectedGuildId,
  },
}));

import { createApp } from '../../src/api/server';
import { signAccessToken } from '../../src/services/authService';

const ORG_ID = '665f9312eb6f3a663b6f0001';

/**
 * Monta header Authorization JWT para testes de rotas Discord.
 * @param role Papel do membership no tenant
 * @returns Valor do header Authorization
 */
function buildAuthHeader(role: string): string {
  const token = signAccessToken({
    id: '665f9312eb6f3a663b6f0099',
    email: 'tester@syntra.test',
    username: 'tester',
    memberships: [{ organizationId: ORG_ID, role }],
  });
  return `Bearer ${token}`;
}

describe('discord settings guilds (cluster proxy)', () => {
  beforeEach(() => {
    guildMocks.resolveDiscordBotConnected.mockResolvedValue(true);
    guildMocks.resolveInstalledGuildCount.mockResolvedValue(2);
    guildMocks.listInstalledGuildSummaries.mockResolvedValue([
      { guildId: 'g1', guildName: 'Alpha', memberCount: 3, iconUrl: undefined },
      { guildId: 'g2', guildName: 'Beta', memberCount: 1, iconUrl: undefined },
    ]);
    guildMocks.getInstalledGuildSummary.mockResolvedValue({
      guildId: 'g1',
      guildName: 'Alpha',
      memberCount: 3,
      iconUrl: undefined,
    });
    guildMocks.findConnections.mockResolvedValue([]);
    guildMocks.findOneConnection.mockResolvedValue(null);
    guildMocks.updateMany.mockResolvedValue({ acknowledged: true });
    guildMocks.findOneAndUpdate.mockResolvedValue({
      guildId: 'g1',
      guildName: 'Alpha',
      iconUrl: undefined,
      isMonitoringEnabled: true,
    });
    guildMocks.setSelectedGuildId.mockResolvedValue(undefined);
  });

  it('GET /discord/status usa resolveInstalledGuildCount (proxy-aware)', async () => {
    const app = createApp();
    const response = await request(app.callback())
      .get(`/api/v1/org/${ORG_ID}/discord/status`)
      .set('Authorization', buildAuthHeader('viewer'));

    expect(response.status).toBe(200);
    expect(response.body.botConnected).toBe(true);
    expect(response.body.guildCount).toBe(2);
    expect(guildMocks.resolveInstalledGuildCount).toHaveBeenCalled();
  });

  it('GET /discord/guilds lista via listInstalledGuildSummaries (proxy-aware)', async () => {
    const app = createApp();
    const response = await request(app.callback())
      .get(`/api/v1/org/${ORG_ID}/discord/guilds`)
      .set('Authorization', buildAuthHeader('viewer'));

    expect(response.status).toBe(200);
    expect(response.body.guilds).toHaveLength(2);
    expect(guildMocks.listInstalledGuildSummaries).toHaveBeenCalled();
  });

  it('POST /discord/guilds/:id/select resolve guild via proxy-aware service', async () => {
    const app = createApp();
    const response = await request(app.callback())
      .post(`/api/v1/org/${ORG_ID}/discord/guilds/g1/select`)
      .set('Authorization', buildAuthHeader('admin'));

    expect(response.status).toBe(200);
    expect(guildMocks.getInstalledGuildSummary).toHaveBeenCalledWith('g1');
    expect(response.body.connection.guildId).toBe('g1');
  });
});
