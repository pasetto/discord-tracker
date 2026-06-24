import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminMocks = vi.hoisted(() => ({
  listAdminPlans: vi.fn(),
  superAdminFindById: vi.fn(),
}));

vi.mock('../../src/services/adminPlanService', () => ({
  listAdminPlans: adminMocks.listAdminPlans,
  getAdminPlanById: vi.fn(),
  createAdminPlan: vi.fn(),
  updateAdminPlan: vi.fn(),
}));

vi.mock('../../src/db/models/PlatformUser', () => ({
  PlatformUserModel: {
    findById: adminMocks.superAdminFindById,
  },
}));

import { createApp } from '../../src/api/server';
import { signAccessToken } from '../../src/services/authService';

/**
 * Monta header Bearer para testes com ID de usuário plataforma.
 * @param userId ID do usuário no JWT
 */
function buildAuthHeader(userId: string): string {
  const token = signAccessToken({
    id: userId,
    email: 'admin@syntra.test',
    username: 'admin',
    memberships: [],
  });
  return `Bearer ${token}`;
}

describe('admin plans routes', () => {
  beforeEach(() => {
    adminMocks.listAdminPlans.mockReset();
    adminMocks.superAdminFindById.mockReset();
  });

  it('retorna 403 quando usuário não é super admin', async () => {
    const app = createApp();
    adminMocks.superAdminFindById.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ _id: 'user-1', isSuperAdmin: false }),
    });

    const response = await request(app.callback())
      .get('/api/v1/admin/plans')
      .set('Authorization', buildAuthHeader('507f1f77bcf86cd799439011'));

    expect(response.status).toBe(403);
    expect(adminMocks.listAdminPlans).not.toHaveBeenCalled();
  });

  it('lista planos para super admin', async () => {
    const app = createApp();
    adminMocks.superAdminFindById.mockReturnValue({
      exec: vi.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011', isSuperAdmin: true }),
    });
    adminMocks.listAdminPlans.mockResolvedValue([
      { id: 'plan-1', name: 'Starter', slug: 'starter', priceCents: 0 },
    ]);

    const response = await request(app.callback())
      .get('/api/v1/admin/plans')
      .set('Authorization', buildAuthHeader('507f1f77bcf86cd799439011'));

    expect(response.status).toBe(200);
    expect(response.body.plans).toHaveLength(1);
    expect(adminMocks.listAdminPlans).toHaveBeenCalled();
  });
});
