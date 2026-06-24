import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/api/server';

describe('security hardening routes', () => {
  it('retorna 410 em rotas legadas sem tenant', async () => {
    const app = createApp();
    const response = await request(app.callback()).get('/reports/daily');
    expect(response.status).toBe(410);
    expect(response.body.error).toContain('legadas');
  });

  it('exige API key em /metrics', async () => {
    const app = createApp();
    const response = await request(app.callback()).get('/metrics');
    expect(response.status).toBe(401);
  });

  it('exige API key em /health/details', async () => {
    const app = createApp();
    const response = await request(app.callback()).get('/health/details');
    expect(response.status).toBe(401);
  });

  it('rejeita webhook Stripe forjado sem assinatura válida', async () => {
    const app = createApp();
    const response = await request(app.callback())
      .post('/api/v1/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send({
        type: 'checkout.session.completed',
        data: { object: { metadata: { organizationId: 'org-1' } } },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeTruthy();
  });
});
