import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = '665f9312eb6f3a663b6f0001';
const USER_ID = '665f9312eb6f3a663b6f0002';

const inactivityMocks = vi.hoisted(() => ({
  getWeeklyInactivityReport: vi.fn(),
  getIntradayInactivityReport: vi.fn(),
  getInactivityHistory: vi.fn(),
  getInactivitySettings: vi.fn(),
  upsertInactivitySettings: vi.fn(),
}));

vi.mock('../../src/services/inactivityService', () => ({
  getWeeklyInactivityReport: inactivityMocks.getWeeklyInactivityReport,
  getInactivityHistory: inactivityMocks.getInactivityHistory,
  getInactivityThresholdSettings: vi.fn(),
}));

vi.mock('../../src/services/intradayInactivityService', () => ({
  getIntradayInactivityReport: inactivityMocks.getIntradayInactivityReport,
}));

vi.mock('../../src/services/inactivitySettingsService', () => ({
  getInactivitySettings: inactivityMocks.getInactivitySettings,
  upsertInactivitySettings: inactivityMocks.upsertInactivitySettings,
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
    id: USER_ID,
    email: 'tester@syntra.test',
    username: 'tester',
    memberships,
  });

  return `Bearer ${token}`;
}

describe('inactivity routes', () => {
  beforeEach(() => {
    inactivityMocks.getWeeklyInactivityReport.mockReset();
    inactivityMocks.getIntradayInactivityReport.mockReset();
    inactivityMocks.getInactivityHistory.mockReset();
    inactivityMocks.getInactivitySettings.mockReset();
    inactivityMocks.upsertInactivitySettings.mockReset();
  });

  it('retorna relatório semanal autenticado', async () => {
    const app = createApp();
    inactivityMocks.getWeeklyInactivityReport.mockResolvedValue({
      periodStart: new Date('2026-06-18'),
      periodEnd: new Date('2026-06-24'),
      generatedAt: new Date('2026-06-24T12:00:00.000Z'),
      entries: [],
      plannedAbsenceEntries: [],
    });

    const response = await request(app.callback())
      .get(`/api/v1/org/${ORG_ID}/guilds/guild-1/reports/inactivity/weekly`)
      .set('Authorization', buildAuthHeader([{ organizationId: ORG_ID, role: 'manager' }]));

    expect(response.status).toBe(200);
    expect(response.body.report).toBeDefined();
  });

  it('retorna relatório intradiário autenticado', async () => {
    const app = createApp();
    inactivityMocks.getIntradayInactivityReport.mockResolvedValue({
      generatedAt: new Date('2026-06-24T12:00:00.000Z'),
      timezone: 'America/Sao_Paulo',
      elapsedWorkPercent: 45,
      elapsedWorkSeconds: 3600,
      totalWorkSeconds: 32400,
      isBusinessDay: true,
      isWithinWorkHours: true,
      settings: { lateStartThresholdPercent: 30, minCollaborationPercentOfElapsed: 20 },
      concernEntries: [{ discordId: '123', displayName: 'Ana', status: 'not_started' }],
      allEntries: [],
    });

    const response = await request(app.callback())
      .get(`/api/v1/org/${ORG_ID}/guilds/guild-1/reports/inactivity/intraday`)
      .set('Authorization', buildAuthHeader([{ organizationId: ORG_ID, role: 'viewer' }]));

    expect(response.status).toBe(200);
    expect(response.body.report.concernEntries).toHaveLength(1);
  });

  it('retorna settings com defaults via GET', async () => {
    const app = createApp();
    inactivityMocks.getInactivitySettings.mockResolvedValue({
      guildId: 'guild-1',
      inactiveAfterBusinessDays: 2,
      zeroVoiceCollaborationDays: 3,
      lateStartThresholdPercent: 30,
      minCollaborationPercentOfElapsed: 20,
      notifyManagerPush: true,
      notifyManagerEmail: false,
    });

    const response = await request(app.callback())
      .get(`/api/v1/org/${ORG_ID}/guilds/guild-1/inactivity-settings`)
      .set('Authorization', buildAuthHeader([{ organizationId: ORG_ID, role: 'manager' }]));

    expect(response.status).toBe(200);
    expect(response.body.settings.lateStartThresholdPercent).toBe(30);
  });

  it('persiste settings via PUT para gestores', async () => {
    const app = createApp();
    inactivityMocks.upsertInactivitySettings.mockResolvedValue({
      guildId: 'guild-1',
      inactiveAfterBusinessDays: 2,
      zeroVoiceCollaborationDays: 3,
      lateStartThresholdPercent: 25,
      minCollaborationPercentOfElapsed: 15,
      notifyManagerPush: true,
      notifyManagerEmail: false,
    });

    const response = await request(app.callback())
      .put(`/api/v1/org/${ORG_ID}/guilds/guild-1/inactivity-settings`)
      .set('Authorization', buildAuthHeader([{ organizationId: ORG_ID, role: 'manager' }]))
      .send({ lateStartThresholdPercent: 25, minCollaborationPercentOfElapsed: 15 });

    expect(response.status).toBe(200);
    expect(response.body.settings.lateStartThresholdPercent).toBe(25);
    expect(inactivityMocks.upsertInactivitySettings).toHaveBeenCalled();
  });

  it('bloqueia PUT de viewer', async () => {
    const app = createApp();

    const response = await request(app.callback())
      .put(`/api/v1/org/${ORG_ID}/guilds/guild-1/inactivity-settings`)
      .set('Authorization', buildAuthHeader([{ organizationId: ORG_ID, role: 'viewer' }]))
      .send({ lateStartThresholdPercent: 25 });

    expect(response.status).toBe(403);
  });

  it('retorna histórico por trackedUserId', async () => {
    const app = createApp();
    inactivityMocks.getInactivityHistory.mockResolvedValue({
      trackedUserId: '665f9312eb6f3a663b6f0010',
      discordId: '123',
      displayName: 'Ana',
      timeline: [{ status: 'missing', inactiveBusinessDays: 3 }],
    });

    const response = await request(app.callback())
      .get(`/api/v1/org/${ORG_ID}/guilds/guild-1/reports/inactivity/history?trackedUserId=665f9312eb6f3a663b6f0010`)
      .set('Authorization', buildAuthHeader([{ organizationId: ORG_ID, role: 'manager' }]));

    expect(response.status).toBe(200);
    expect(response.body.history.timeline).toHaveLength(1);
  });
});
