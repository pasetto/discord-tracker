import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { createApp } from '../../src/api/server';
import { signAccessToken } from '../../src/services/authService';

/**
 * Progresso de onboarding esperado nos payloads de API.
 */
interface OnboardingProgress {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  completedSteps: number[];
  botConnected: boolean;
  guildSelected: boolean;
  channelsConfigured: boolean;
  calendarConfigured: boolean;
  categoriesConfigured: boolean;
  membersAssigned: boolean;
  completedAt?: string;
}

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

describe('onboarding routes', () => {
  beforeEach(() => {
    organizationModelMocks.findById.mockReset();
    organizationModelMocks.findByIdAndUpdate.mockReset();
  });

  it('retorna 401 ao acessar sem JWT', async () => {
    const app = createApp();
    const response = await request(app.callback()).get('/api/v1/org/org-1/onboarding');
    expect(response.status).toBe(401);
  });

  it('retorna onboarding no GET autenticado', async () => {
    const app = createApp();
    const onboarding: OnboardingProgress = {
      currentStep: 5,
      completedSteps: [1, 2, 3, 4, 5],
      botConnected: true,
      guildSelected: true,
      channelsConfigured: true,
      calendarConfigured: true,
      categoriesConfigured: false,
      membersAssigned: false,
    };
    organizationModelMocks.findById.mockResolvedValue({
      _id: 'org-1',
      onboarding,
    });

    const response = await request(app.callback())
      .get('/api/v1/org/org-1/onboarding')
      .set('Authorization', buildAuthHeader([{ organizationId: 'org-1', role: 'manager' }]));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ onboarding });
    expect(organizationModelMocks.findById).toHaveBeenCalledWith('org-1', { onboarding: 1 });
  });

  it('atualiza onboarding no PUT autenticado', async () => {
    const app = createApp();
    const onboarding: OnboardingProgress = {
      currentStep: 4,
      completedSteps: [1, 2, 3, 4],
      botConnected: true,
      guildSelected: true,
      channelsConfigured: true,
      calendarConfigured: false,
      categoriesConfigured: false,
      membersAssigned: false,
    };
    organizationModelMocks.findByIdAndUpdate.mockResolvedValue({
      _id: 'org-1',
      onboarding,
    });

    const response = await request(app.callback())
      .put('/api/v1/org/org-1/onboarding')
      .set('Authorization', buildAuthHeader([{ organizationId: 'org-1', role: 'manager' }]))
      .send({ onboarding });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ onboarding });
    expect(organizationModelMocks.findByIdAndUpdate).toHaveBeenCalledWith(
      'org-1',
      { $set: { onboarding } },
      { new: true, projection: { onboarding: 1 } },
    );
  });
});
