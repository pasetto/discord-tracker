import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const inactivityServiceMocks = vi.hoisted(() => ({
  getWeeklyInactivityReport: vi.fn(),
}));

const goalsServiceMocks = vi.hoisted(() => ({
  getGoalsWeeklyReport: vi.fn(),
}));

vi.mock('../../src/services/inactivityService', () => ({
  getWeeklyInactivityReport: inactivityServiceMocks.getWeeklyInactivityReport,
}));

vi.mock('../../src/services/goalsService', () => ({
  getGoalsWeeklyReport: goalsServiceMocks.getGoalsWeeklyReport,
}));

import { createApp } from '../../src/api/server';
import { signAccessToken } from '../../src/services/authService';

/**
 * Monta header Authorization Bearer para cenários autenticados.
 * @param memberships Memberships válidas no JWT
 * @returns Header Authorization pronto para o Supertest
 */
function buildAuthHeader(memberships: Array<{ organizationId: string; role: string }>): string {
  const token = signAccessToken({
    id: '665f9312eb6f3a663b6f0099',
    email: 'manager@syntra.test',
    username: 'manager',
    memberships,
  });

  return `Bearer ${token}`;
}

describe('export routes', () => {
  beforeEach(() => {
    inactivityServiceMocks.getWeeklyInactivityReport.mockReset();
    goalsServiceMocks.getGoalsWeeklyReport.mockReset();
  });

  it('exporta CSV de inatividade semanal para manager', async () => {
    const app = createApp();
    inactivityServiceMocks.getWeeklyInactivityReport.mockResolvedValue({
      periodStart: new Date('2026-06-15T00:00:00.000Z'),
      periodEnd: new Date('2026-06-21T00:00:00.000Z'),
      generatedAt: new Date('2026-06-21T12:00:00.000Z'),
      entries: [
        {
          trackedUserId: '665f9312eb6f3a663b6f0011',
          discordId: 'discord-1',
          displayName: 'Colab 1',
          categoryName: 'Dev',
          lastSeenAt: new Date('2026-06-20T09:30:00.000Z'),
          lastVoiceCollaborationAt: null,
          lastTextActivityAt: new Date('2026-06-20T08:30:00.000Z'),
          lastPresenceAt: new Date('2026-06-20T09:30:00.000Z'),
          inactiveBusinessDays: 3,
          status: 'missing',
        },
      ],
      plannedAbsenceEntries: [],
    });

    const response = await request(app.callback())
      .post('/api/v1/org/665f9312eb6f3a663b6f0001/guilds/guild-1/export/inactivity')
      .set('Authorization', buildAuthHeader([{ organizationId: '665f9312eb6f3a663b6f0001', role: 'manager' }]));

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('attachment; filename=');
    expect(response.text).toContain('displayName,discordId,categoryName,status,inactiveBusinessDays');
    expect(response.text).toContain('Colab 1,discord-1,Dev,missing,3');
  });

  it('retorna 403 ao exportar CSV de inatividade sem role manager', async () => {
    const app = createApp();

    const response = await request(app.callback())
      .post('/api/v1/org/665f9312eb6f3a663b6f0001/guilds/guild-1/export/inactivity')
      .set('Authorization', buildAuthHeader([{ organizationId: '665f9312eb6f3a663b6f0001', role: 'viewer' }]));

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Permissão insuficiente');
  });

  it('exporta CSV de resumo de colaboração para manager', async () => {
    const app = createApp();
    goalsServiceMocks.getGoalsWeeklyReport.mockResolvedValue({
      periodStart: new Date('2026-06-15T00:00:00.000Z'),
      periodEnd: new Date('2026-06-21T00:00:00.000Z'),
      generatedAt: new Date('2026-06-21T12:00:00.000Z'),
      entries: [
        {
          trackedUserId: '665f9312eb6f3a663b6f0011',
          discordId: 'discord-1',
          displayName: 'Colab 1',
          weeklyGoalHours: 12,
          periodMinimumHours: 10,
          businessDaysInPeriod: 5,
          dailyMinimumHours: 2,
          realizedHours: 8.25,
          progressPercent: 68.75,
          shouldAlertLowProgress: false,
        },
      ],
    });

    const response = await request(app.callback())
      .post('/api/v1/org/665f9312eb6f3a663b6f0001/guilds/guild-1/export/csv')
      .set('Authorization', buildAuthHeader([{ organizationId: '665f9312eb6f3a663b6f0001', role: 'manager' }]));

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('displayName,discordId,weeklyGoalHours,periodMinimumHours,businessDaysInPeriod,realizedHours,progressPercent');
    expect(response.text).toContain('Colab 1,discord-1,12,10,5,8.25,68.75');
  });
});
