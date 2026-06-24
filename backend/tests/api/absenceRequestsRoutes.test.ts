import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signAccessToken } from '../../src/services/authService';

const plannedAbsenceServiceMocks = vi.hoisted(() => ({
  listPlannedAbsences: vi.fn(),
  listActivePlannedAbsences: vi.fn(),
  createPlannedAbsence: vi.fn(),
  updatePlannedAbsence: vi.fn(),
  cancelPlannedAbsence: vi.fn(),
  listAbsenceRequests: vi.fn(),
  approveAbsenceRequest: vi.fn(),
  rejectAbsenceRequest: vi.fn(),
}));

vi.mock('../../src/services/plannedAbsenceService', () => plannedAbsenceServiceMocks);

import { createApp } from '../../src/api/server';

/**
 * Cria header Authorization Bearer para cenários autenticados.
 * @param role Papel do usuário no tenant do teste
 * @returns Header Authorization pronto para o Supertest
 */
function buildAuthHeader(role: string): string {
  const token = signAccessToken({
    id: '665f9312eb6f3a663b6f0099',
    email: 'manager@syntra.test',
    username: 'manager',
    memberships: [{ organizationId: '665f9312eb6f3a663b6f0001', role }],
  });

  return `Bearer ${token}`;
}

describe('absence requests routes', () => {
  beforeEach(() => {
    plannedAbsenceServiceMocks.listAbsenceRequests.mockReset();
    plannedAbsenceServiceMocks.approveAbsenceRequest.mockReset();
    plannedAbsenceServiceMocks.rejectAbsenceRequest.mockReset();
  });

  it('lista solicitações pendentes para manager', async () => {
    const app = createApp();
    plannedAbsenceServiceMocks.listAbsenceRequests.mockResolvedValue([
      {
        _id: '665f9312eb6f3a663b6f00ab',
        guildId: 'guild-1',
        status: 'pending_approval',
        type: 'pto',
      },
    ]);

    const response = await request(app.callback())
      .get('/api/v1/org/665f9312eb6f3a663b6f0001/guilds/guild-1/absence-requests?status=pending_approval')
      .set('Authorization', buildAuthHeader('manager'));

    expect(response.status).toBe(200);
    expect(response.body.requests).toHaveLength(1);
    expect(plannedAbsenceServiceMocks.listAbsenceRequests).toHaveBeenCalledWith(
      '665f9312eb6f3a663b6f0001',
      'guild-1',
      'pending_approval',
    );
  });

  it('aprova solicitação pendente', async () => {
    const app = createApp();
    plannedAbsenceServiceMocks.approveAbsenceRequest.mockResolvedValue({
      _id: '665f9312eb6f3a663b6f00ab',
      status: 'scheduled',
    });

    const response = await request(app.callback())
      .post('/api/v1/org/665f9312eb6f3a663b6f0001/guilds/guild-1/absence-requests/665f9312eb6f3a663b6f00ab/approve')
      .set('Authorization', buildAuthHeader('admin'));

    expect(response.status).toBe(200);
    expect(response.body.request.status).toBe('scheduled');
    expect(plannedAbsenceServiceMocks.approveAbsenceRequest).toHaveBeenCalledTimes(1);
  });

  it('nega acesso para usuário sem papel de gestão', async () => {
    const app = createApp();

    const response = await request(app.callback())
      .post('/api/v1/org/665f9312eb6f3a663b6f0001/guilds/guild-1/absence-requests/665f9312eb6f3a663b6f00ab/reject')
      .set('Authorization', buildAuthHeader('viewer'));

    expect(response.status).toBe(403);
    expect(plannedAbsenceServiceMocks.rejectAbsenceRequest).not.toHaveBeenCalled();
  });
});
