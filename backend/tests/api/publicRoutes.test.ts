import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/server';

vi.mock('../../src/services/discordApplicationService', () => ({
  getPublicDiscordClientId: vi.fn(async () => 'discord-client-id-test'),
}));

describe('public routes', () => {
  it('retorna configuração pública em /api/v1/public/config', async () => {
    const app = createApp();

    const response = await request(app.callback()).get('/api/v1/public/config');

    expect(response.status).toBe(200);
    expect(response.body.appName).toBe('Syntra');
    expect(response.body.discordClientId).toBe('discord-client-id-test');
    expect(response.body.authMode).toBe('email_password');
    expect(response.body.botConfigured).toBe(true);
    expect(response.body.apiBaseUrl).toBeTruthy();
  });
});
