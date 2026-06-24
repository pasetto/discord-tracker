import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const defaultRules = {
  ignored: [],
  afk: [],
  lunch: [],
  productiveVoice: [],
  productiveText: [],
  ignoredText: [],
};

const repositoryMocks = vi.hoisted(() => ({
  getByGuild: vi.fn(),
  upsertByGuild: vi.fn(),
}));

const channelListMocks = vi.hoisted(() => ({
  listGuildDiscordChannels: vi.fn(),
}));

vi.mock('../../src/repositories/channelRuleRepository', () => ({
  channelRuleRepository: {
    getByGuild: repositoryMocks.getByGuild,
    upsertByGuild: repositoryMocks.upsertByGuild,
  },
}));

vi.mock('../../src/services/discordGuildChannelService', () => ({
  listGuildDiscordChannels: channelListMocks.listGuildDiscordChannels,
}));

import { createApp } from '../../src/api/server';
import { signAccessToken } from '../../src/services/authService';

/**
 * Gera header Authorization para testes autenticados.
 * @param memberships Lista de memberships do usuário JWT
 * @returns Header no formato Bearer
 */
function buildAuthHeader(memberships: Array<{ organizationId: string; role: string }>): string {
  const token = signAccessToken({
    id: 'user-1',
    email: 'tester@syntra.test',
    username: 'tester',
    memberships,
  });

  return `Bearer ${token}`;
}

describe('channels routes', () => {
  beforeEach(() => {
    repositoryMocks.getByGuild.mockReset();
    repositoryMocks.upsertByGuild.mockReset();
    channelListMocks.listGuildDiscordChannels.mockReset();
  });

  it('lista canais do Discord no GET autenticado', async () => {
    const app = createApp();
    channelListMocks.listGuildDiscordChannels.mockReturnValue([
      { channelId: '1', channelName: 'Geral', channelType: 'voice' as const },
    ]);

    const response = await request(app.callback())
      .get('/api/v1/org/org-1/guilds/guild-1/channels/discord')
      .set('Authorization', buildAuthHeader([{ organizationId: 'org-1', role: 'manager' }]));

    expect(response.status).toBe(200);
    expect(response.body.channels).toHaveLength(1);
    expect(channelListMocks.listGuildDiscordChannels).toHaveBeenCalledWith('guild-1');
  });

  it('retorna 503 quando bot não consegue listar canais', async () => {
    const app = createApp();
    channelListMocks.listGuildDiscordChannels.mockImplementation(() => {
      throw new Error('Bot Discord não conectado');
    });

    const response = await request(app.callback())
      .get('/api/v1/org/org-1/guilds/guild-1/channels/discord')
      .set('Authorization', buildAuthHeader([{ organizationId: 'org-1', role: 'manager' }]));

    expect(response.status).toBe(503);
    expect(response.body.error).toContain('Bot Discord não conectado');
  });

  it('retorna 401 ao acessar sem JWT', async () => {
    const app = createApp();
    const response = await request(app.callback()).get('/api/v1/org/org-1/guilds/guild-1/channels');
    expect(response.status).toBe(401);
  });

  it('retorna regras atuais no GET autenticado', async () => {
    const app = createApp();
    repositoryMocks.getByGuild.mockResolvedValue(defaultRules);

    const response = await request(app.callback())
      .get('/api/v1/org/org-1/guilds/guild-1/channels')
      .set('Authorization', buildAuthHeader([{ organizationId: 'org-1', role: 'manager' }]));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ rules: defaultRules });
    expect(repositoryMocks.getByGuild).toHaveBeenCalledWith('org-1', 'guild-1');
  });

  it('salva regras no PUT autenticado', async () => {
    const app = createApp();
    const payload = {
      rules: {
        ...defaultRules,
        productiveText: [{ channelId: '10', channelName: 'dev-chat', channelType: 'text' as const }],
      },
    };
    repositoryMocks.upsertByGuild.mockResolvedValue(payload.rules);

    const response = await request(app.callback())
      .put('/api/v1/org/org-1/guilds/guild-1/channels')
      .set('Authorization', buildAuthHeader([{ organizationId: 'org-1', role: 'manager' }]))
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(payload);
    expect(repositoryMocks.upsertByGuild).toHaveBeenCalledWith('org-1', 'guild-1', payload.rules);
  });
});
