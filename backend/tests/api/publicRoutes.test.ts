import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/api/server';
import { config } from '../../src/config/env';

describe('public routes', () => {
  it('retorna configuração pública em /api/v1/public/config', async () => {
    const app = createApp();

    const response = await request(app.callback()).get('/api/v1/public/config');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      appName: 'Syntra',
      discordClientId: config.discordOauthClientId,
      pricingEnabled: true,
    });
  });
});
