import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dashboardMocks = vi.hoisted(() => ({
  getGuildLiveDashboard: vi.fn(),
  getGuildDashboardOverview: vi.fn(),
}));

vi.mock('../../src/services/dashboardLiveService', () => ({
  getGuildLiveDashboard: dashboardMocks.getGuildLiveDashboard,
}));

vi.mock('../../src/services/dashboardOverviewService', () => ({
  getGuildDashboardOverview: dashboardMocks.getGuildDashboardOverview,
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
    dashboardMocks.getGuildDashboardOverview.mockReset();
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

  it('retorna overview histórico autenticado', async () => {
    const app = createApp();
    dashboardMocks.getGuildDashboardOverview.mockResolvedValue({
      generatedAt: new Date().toISOString(),
      timezone: 'America/Sao_Paulo',
      periodStart: '2026-06-26',
      periodEnd: '2026-07-02',
      trackedMembersCount: 3,
      weeklyAverageHours: 12.5,
      dailyCollaboration: [{ date: '2026-07-02', collaborationHours: 8, voiceHours: 9 }],
      heatmap: [{ dayIndex: 0, hour: 10, eventCount: 2 }],
    });

    const response = await request(app.callback())
      .get('/api/v1/org/org-1/guilds/guild-1/dashboard/overview')
      .set('Authorization', buildAuthHeader([{ organizationId: 'org-1', role: 'viewer' }]));

    expect(response.status).toBe(200);
    expect(response.body.overview.trackedMembersCount).toBe(3);
    expect(response.body.overview.dailyCollaboration).toHaveLength(1);
    expect(dashboardMocks.getGuildDashboardOverview).toHaveBeenCalledWith('org-1', 'guild-1');
  });
});
