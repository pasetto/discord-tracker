import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/server';

vi.mock('../../src/services/discordApplicationService', () => ({
  getPublicDiscordClientId: vi.fn(async () => 'discord-client-id-test'),
}));

vi.mock('../../src/services/billingService', () => ({
  listPublicPlans: vi.fn(async () => [
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
}));

describe('public routes', () => {
  it('retorna configuração pública em /api/v1/public/config', async () => {
    const app = createApp();

    const response = await request(app.callback()).get('/api/v1/public/config');

    expect(response.status).toBe(200);
    expect(response.body.appName).toBe('Syntra');
    expect(response.body.apiVersion).toBe('1.2.0');
    expect(response.body.discordClientId).toBe('discord-client-id-test');
    expect(response.body.authMode).toBe('email_password');
    expect(response.body.botConfigured).toBe(true);
    expect(response.body.apiBaseUrl).toBeTruthy();
  });

  it('retorna planos públicos em /api/v1/pricing', async () => {
    const app = createApp();

    const response = await request(app.callback()).get('/api/v1/pricing');

    expect(response.status).toBe(200);
    expect(response.body.plans).toHaveLength(2);
    expect(response.body.plans[1].slug).toBe('business');
    expect(response.body.plans[1].features.webhooks).toBe(true);
  });
});
