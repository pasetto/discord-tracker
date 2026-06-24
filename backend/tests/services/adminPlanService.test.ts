import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminPlan, listAdminPlans } from '../../src/services/adminPlanService';
import { PlanModel } from '../../src/db/models/Plan';

vi.mock('../../src/db/models/Plan', () => ({
  PlanModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create: vi.fn(),
  },
}));

describe('adminPlanService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista planos ordenados', async () => {
    const planDoc = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Starter',
      slug: 'starter',
      description: 'Plano inicial',
      priceCents: 9900,
      currency: 'BRL',
      billingInterval: 'month',
      limits: { maxGuilds: 1, maxTrackedMembers: 25, dataRetentionDays: 90 },
      features: {
        gamification: false,
        ranking: false,
        exportCsv: false,
        exportPdf: false,
        apiAccess: false,
        webhooks: false,
        customChannelRules: true,
        teamGoals: false,
        advancedReports: false,
      },
      isActive: true,
      isPublic: true,
      sortOrder: 1,
      trialDays: 14,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    };

    vi.mocked(PlanModel.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue([planDoc]),
      }),
    } as never);

    const plans = await listAdminPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0].slug).toBe('starter');
    expect(plans[0].priceCents).toBe(9900);
  });

  it('rejeita slug duplicado ao criar', async () => {
    vi.mocked(PlanModel.findOne).mockReturnValue({
      exec: vi.fn().mockResolvedValue({ slug: 'pro' }),
    } as never);

    await expect(
      createAdminPlan({
        name: 'Pro',
        slug: 'pro',
        description: 'Plano pro',
        priceCents: 19900,
        billingInterval: 'month',
        limits: { maxGuilds: 1, maxTrackedMembers: 50, dataRetentionDays: 180 },
        features: {
          gamification: true,
          ranking: true,
          exportCsv: true,
          exportPdf: false,
          apiAccess: false,
          webhooks: false,
          customChannelRules: true,
          teamGoals: false,
          advancedReports: false,
        },
        isActive: true,
        isPublic: true,
        sortOrder: 2,
        trialDays: 14,
      }),
    ).rejects.toThrow('Já existe um plano com este slug');
  });
});
