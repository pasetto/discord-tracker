import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dashboardMocks = vi.hoisted(() => ({
  getGuildLiveDashboard: vi.fn(),
}));

vi.mock('../../src/services/dashboardLiveService', () => ({
  getGuildLiveDashboard: dashboardMocks.getGuildLiveDashboard,
}));

vi.mock('../../src/services/guildAccessService', () => ({
  assertGuildMonitoredByOrganization: vi.fn().mockResolvedValue(undefined),
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

describe('dashboard routes', () => {
  beforeEach(() => {
    dashboardMocks.getGuildLiveDashboard.mockReset();
  });

  it('retorna snapshot ao vivo autenticado', async () => {
    const app = createApp();
    dashboardMocks.getGuildLiveDashboard.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      guildId: 'guild-1',
      guildName: 'eCondos',
      activeCount: 1,
      activeMembers: [],
      onlineRanking: [],
    });

    const response = await request(app.callback())
      .get('/api/v1/org/org-1/guilds/guild-1/dashboard/live')
      .set('Authorization', buildAuthHeader([{ organizationId: 'org-1', role: 'manager' }]));

    expect(response.status).toBe(200);
    expect(response.body.activeCount).toBe(1);
    expect(dashboardMocks.getGuildLiveDashboard).toHaveBeenCalledWith('guild-1', 'org-1');
  });
});
