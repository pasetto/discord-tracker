import { describe, expect, it } from 'vitest';
import {
  FALLBACK_PRICING_PLANS,
  buildPlanHighlights,
  formatBrlMonthly,
  type PublicPlanDto,
} from './public-pricing';

describe('site public pricing helpers (SYN-111)', () => {
  it('expõe fallback com 3 planos em BRL e Team featured', () => {
    expect(FALLBACK_PRICING_PLANS).toHaveLength(3);
    expect(FALLBACK_PRICING_PLANS.map((p) => p.slug)).toEqual([
      'starter',
      'team',
      'business',
    ]);
    expect(FALLBACK_PRICING_PLANS.find((p) => p.slug === 'team')?.featured).toBe(true);
    for (const plan of FALLBACK_PRICING_PLANS) {
      expect(plan.priceBrlMonthly.startsWith('R$')).toBe(true);
    }
  });

  it('formatBrlMonthly formata centavos inteiros e fracionários', () => {
    expect(formatBrlMonthly(7900)).toBe('R$ 79');
    expect(formatBrlMonthly(7990)).toBe('R$ 79,90');
  });

  it('buildPlanHighlights monta bullets a partir de features', () => {
    const plan: PublicPlanDto = {
      slug: 'business',
      name: 'Business',
      description: 'Ops',
      priceCents: 29900,
      currency: 'BRL',
      billingInterval: 'month',
      limits: { maxGuilds: 3, maxTrackedMembers: 200, dataRetentionDays: 90 },
      features: {
        apiAccess: true,
        webhooks: true,
        ranking: true,
        exportCsv: true,
      },
      trialDays: 14,
      sortOrder: 3,
    };
    const highlights = buildPlanHighlights(plan);
    // Limite de 3 bullets (mesmo contrato do Angular).
    expect(highlights).toHaveLength(3);
    expect(highlights).toEqual([
      'Até 3 servidores Discord',
      'Acesso à API',
      'Webhooks de integração',
    ]);
  });
});
