import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/server';
import { signAccessToken } from '../../src/services/authService';

const organizationModelMocks = vi.hoisted(() => ({
  findById: vi.fn(),
  findByIdAndUpdate: vi.fn(),
}));

vi.mock('../../src/db/models/Organization', () => ({
  OrganizationModel: {
    findById: organizationModelMocks.findById,
    findByIdAndUpdate: organizationModelMocks.findByIdAndUpdate,
  },
}));

/**
 * Gera header Authorization para cenário autenticado.
 * @param role Papel do membership no tenant
 * @returns Header Bearer para o Supertest
 */
function buildAuthHeader(role: string): string {
  const token = signAccessToken({
    id: '665f9312eb6f3a663b6f0099',
    email: 'admin@syntra.test',
    username: 'admin',
    memberships: [{ organizationId: '665f9312eb6f3a663b6f0001', role }],
  });

  return `Bearer ${token}`;
}

describe('organization settings routes', () => {
  beforeEach(() => {
    organizationModelMocks.findById.mockReset();
    organizationModelMocks.findByIdAndUpdate.mockReset();
  });

  it('atualiza permissões quando papel é owner/admin', async () => {
    organizationModelMocks.findByIdAndUpdate.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            settings: { viewerCanSeeIndividualReports: true },
          }),
        }),
      }),
    });

    const app = createApp();
    const response = await request(app.callback())
      .put('/api/v1/org/665f9312eb6f3a663b6f0001/settings/permissions')
      .set('Authorization', buildAuthHeader('admin'))
      .send({ viewerCanSeeIndividualReports: true });

    expect(response.status).toBe(200);
    expect(response.body.permissions.viewerCanSeeIndividualReports).toBe(true);
  });

  it('bloqueia atualização para manager', async () => {
    const app = createApp();
    const response = await request(app.callback())
      .put('/api/v1/org/665f9312eb6f3a663b6f0001/settings/permissions')
      .set('Authorization', buildAuthHeader('manager'))
      .send({ viewerCanSeeIndividualReports: true });

    expect(response.status).toBe(403);
    expect(organizationModelMocks.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('retorna permissões para admin', async () => {
    organizationModelMocks.findById.mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockReturnValue({
          exec: vi.fn().mockResolvedValue({
            settings: { viewerCanSeeIndividualReports: false },
          }),
        }),
      }),
    });

    const app = createApp();
    const response = await request(app.callback())
      .get('/api/v1/org/665f9312eb6f3a663b6f0001/settings/permissions')
      .set('Authorization', buildAuthHeader('owner'));

    expect(response.status).toBe(200);
    expect(response.body.permissions.viewerCanSeeIndividualReports).toBe(false);
  });
});
