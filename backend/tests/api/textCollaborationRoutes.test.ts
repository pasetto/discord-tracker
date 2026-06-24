import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG_ID = '665f9312eb6f3a663b6f0001';
const USER_ID = '665f9312eb6f3a663b6f0002';

const textReportMocks = vi.hoisted(() => ({
  getTextCollaborationReport: vi.fn(),
}));

vi.mock('../../src/services/textCollaborationReportService', () => ({
  getTextCollaborationReport: textReportMocks.getTextCollaborationReport,
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

describe('text collaboration report routes', () => {
  beforeEach(() => {
    textReportMocks.getTextCollaborationReport.mockReset();
  });

  it('retorna relatório para usuário viewer', async () => {
    const app = createApp();
    textReportMocks.getTextCollaborationReport.mockResolvedValue({
      from: new Date('2026-06-24T00:00:00.000Z'),
      to: new Date('2026-06-24T23:59:59.999Z'),
      generatedAt: new Date('2026-06-24T12:00:00.000Z'),
      entries: [
        {
          discordId: 'u-1',
          displayName: 'Ana',
          categoryId: null,
          eventsCount: 3,
          lastOccurredAt: new Date('2026-06-24T11:00:00.000Z'),
        },
      ],
    });

    const response = await request(app.callback())
      .get(`/api/v1/org/${ORG_ID}/guilds/guild-1/reports/text-collaboration?from=2026-06-24T00:00:00.000Z&to=2026-06-24T23:59:59.999Z`)
      .set('Authorization', buildAuthHeader([{ organizationId: ORG_ID, role: 'viewer' }]));

    expect(response.status).toBe(200);
    expect(response.body.report.entries).toHaveLength(1);
    expect(textReportMocks.getTextCollaborationReport).toHaveBeenCalledTimes(1);
  });

  it('bloqueia acesso para role sem permissão', async () => {
    const app = createApp();

    const response = await request(app.callback())
      .get(`/api/v1/org/${ORG_ID}/guilds/guild-1/reports/text-collaboration?from=2026-06-24T00:00:00.000Z&to=2026-06-24T23:59:59.999Z`)
      .set('Authorization', buildAuthHeader([{ organizationId: ORG_ID, role: 'guest' }]));

    expect(response.status).toBe(403);
  });

  it('retorna 400 quando query params são inválidos', async () => {
    const app = createApp();

    const response = await request(app.callback())
      .get(`/api/v1/org/${ORG_ID}/guilds/guild-1/reports/text-collaboration?from=invalid&to=2026-06-24T23:59:59.999Z`)
      .set('Authorization', buildAuthHeader([{ organizationId: ORG_ID, role: 'manager' }]));

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('from inválido');
  });
});
