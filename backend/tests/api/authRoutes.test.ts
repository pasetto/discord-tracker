import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/api/server';

describe('auth routes', () => {
  it('redireciona para OAuth2 do Discord em /api/v1/auth/discord', async () => {
    const app = createApp();

    const response = await request(app.callback()).get('/api/v1/auth/discord');

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('discord.com/oauth2/authorize');
  });

  it('retorna 401 ao acessar relatório diário sem JWT', async () => {
    const app = createApp();

    const response = await request(app.callback()).get('/api/v1/org/org-1/reports/daily');

    expect(response.status).toBe(401);
  });
});
