import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const teamServiceMocks = vi.hoisted(() => ({
  ensureOrganizationInviteCode: vi.fn(),
  listOrganizationMembers: vi.fn(),
  approveOrganizationMember: vi.fn(),
  hasActiveOrganizationMembership: vi.fn(),
}));

const platformUserMocks = vi.hoisted(() => ({
  findById: vi.fn(),
}));

vi.mock('../../src/services/organizationTeamService', () => ({
  ensureOrganizationInviteCode: teamServiceMocks.ensureOrganizationInviteCode,
  listOrganizationMembers: teamServiceMocks.listOrganizationMembers,
  approveOrganizationMember: teamServiceMocks.approveOrganizationMember,
  regenerateOrganizationInviteCode: vi.fn(),
  removeOrganizationMember: vi.fn(),
  hasActiveOrganizationMembership: teamServiceMocks.hasActiveOrganizationMembership,
  previewOrganizationInvite: vi.fn(),
  requestOrganizationJoin: vi.fn(),
  listUserOrganizations: vi.fn(),
  generateOrganizationInviteCode: vi.fn(),
  normalizeInviteCode: vi.fn(),
  createUniqueOrganizationInviteCode: vi.fn(),
}));

vi.mock('../../src/db/models/PlatformUser', () => ({
  PlatformUserModel: {
    findById: platformUserMocks.findById,
  },
}));

import { createApp } from '../../src/api/server';
import { signAccessToken } from '../../src/services/authService';

/**
 * Gera header Authorization para testes autenticados.
 * @param memberships Memberships do JWT
 * @returns Header Bearer
 */
function buildAuthHeader(
  memberships: Array<{ organizationId: string; role: string; status?: 'active' | 'pending' }>,
): string {
  const token = signAccessToken({
    id: 'user-1',
    email: 'tester@syntra.test',
    username: 'tester',
    memberships,
  });

  return `Bearer ${token}`;
}

/**
 * Configura usuário plataforma com membership ativa na organização.
 */
function mockActivePlatformUser(): void {
  platformUserMocks.findById.mockReturnValue({
    exec: vi.fn().mockResolvedValue({
      _id: 'user-1',
      memberships: [
        {
          organizationId: 'org-1',
          role: 'admin',
          acceptedAt: new Date('2026-06-24T12:00:00.000Z'),
        },
      ],
    }),
  });
  teamServiceMocks.hasActiveOrganizationMembership.mockReturnValue(true);
}

describe('organization team routes', () => {
  beforeEach(() => {
    teamServiceMocks.ensureOrganizationInviteCode.mockReset();
    teamServiceMocks.listOrganizationMembers.mockReset();
    teamServiceMocks.approveOrganizationMember.mockReset();
    teamServiceMocks.hasActiveOrganizationMembership.mockReset();
    platformUserMocks.findById.mockReset();
    mockActivePlatformUser();
  });

  it('retorna código de convite para membro ativo', async () => {
    teamServiceMocks.ensureOrganizationInviteCode.mockResolvedValue('AB12CD34');
    const app = createApp();

    const response = await request(app.callback())
      .get('/api/v1/org/org-1/team/invite-code')
      .set('Authorization', buildAuthHeader([{ organizationId: 'org-1', role: 'admin', status: 'active' }]));

    expect(response.status).toBe(200);
    expect(response.body.inviteCode).toBe('AB12CD34');
  });

  it('bloqueia membership pendente no tenant middleware', async () => {
    const app = createApp();

    const response = await request(app.callback())
      .get('/api/v1/org/org-1/team/invite-code')
      .set('Authorization', buildAuthHeader([{ organizationId: 'org-1', role: 'admin', status: 'pending' }]));

    expect(response.status).toBe(403);
  });

  it('lista membros da organização', async () => {
    teamServiceMocks.listOrganizationMembers.mockResolvedValue([
      {
        userId: 'user-2',
        email: 'novo@test.com',
        displayName: 'Novo',
        role: 'admin',
        status: 'pending',
        invitedAt: '2026-06-24T12:00:00.000Z',
      },
    ]);
    const app = createApp();

    const response = await request(app.callback())
      .get('/api/v1/org/org-1/team/members')
      .set('Authorization', buildAuthHeader([{ organizationId: 'org-1', role: 'owner', status: 'active' }]));

    expect(response.status).toBe(200);
    expect(response.body.members).toHaveLength(1);
    expect(response.body.members[0].status).toBe('pending');
  });
});
