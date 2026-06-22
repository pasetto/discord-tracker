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

vi.mock('../../src/repositories/channelRuleRepository', () => ({
  channelRuleRepository: {
    getByGuild: repositoryMocks.getByGuild,
    upsertByGuild: repositoryMocks.upsertByGuild,
  },
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
    discordId: 'discord-1',
    username: 'tester',
    memberships,
  });

  return `Bearer ${token}`;
}

describe('channels routes', () => {
  beforeEach(() => {
    repositoryMocks.getByGuild.mockReset();
    repositoryMocks.upsertByGuild.mockReset();
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
