import { beforeEach, describe, expect, it, vi } from 'vitest';

const planFindMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/db/models/Plan', () => ({
  PlanModel: {
    find: planFindMock,
    findOne: vi.fn(),
  },
}));

import { listPublicPlans, toPublicPlanDto } from '../../src/services/billingService';

describe('billingService public plans', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('lista planos públicos ativos ordenados', async () => {
    planFindMock.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue([
          {
            slug: 'starter',
            name: 'Starter',
            description: 'Entrada',
            priceCents: 7900,
            currency: 'BRL',
            billingInterval: 'month',
            limits: { maxGuilds: 1, maxTrackedMembers: 25, dataRetentionDays: 90 },
            features: { exportCsv: false, apiAccess: false, webhooks: false },
            trialDays: 7,
            sortOrder: 1,
          },
          {
            slug: 'business',
            name: 'Business',
            description: 'Escala',
            priceCents: 29900,
            currency: 'BRL',
            billingInterval: 'month',
            limits: { maxGuilds: 3, maxTrackedMembers: 200, dataRetentionDays: 365 },
            features: { exportCsv: true, apiAccess: true, webhooks: true },
            trialDays: 7,
            sortOrder: 3,
          },
        ]),
      }),
    });

    const plans = await listPublicPlans();

    expect(plans).toHaveLength(2);
    expect(plans[0].slug).toBe('starter');
    expect(plans[1].features.webhooks).toBe(true);
    expect(planFindMock).toHaveBeenCalledWith({ isActive: true, isPublic: true });
  });

  it('toPublicPlanDto omite campos internos do Stripe', () => {
    const dto = toPublicPlanDto({
      slug: 'team',
      name: 'Team',
      description: 'Time',
      priceCents: 14900,
      currency: 'BRL',
      billingInterval: 'month',
      limits: { maxGuilds: 1, maxTrackedMembers: 75, dataRetentionDays: 180 },
      features: { exportCsv: true } as never,
      trialDays: 7,
      sortOrder: 2,
    } as never);

    expect(dto).toMatchObject({
      slug: 'team',
      priceCents: 14900,
    });
    expect(dto).not.toHaveProperty('stripePriceId');
  });
});
