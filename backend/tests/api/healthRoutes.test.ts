import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/server';
import {
  markApplicationReady,
  markApplicationStarting,
  markApplicationUnhealthy,
} from '../../src/runtime/applicationState';

vi.mock('../../src/bot/client', () => ({
  checkDiscordHealth: vi.fn(() => true),
  getDiscordPing: vi.fn(() => 42),
}));

vi.mock('../../src/db/connection', () => ({
  checkMongoHealth: vi.fn(() => true),
}));

vi.mock('../../src/runtime/clusterRole', () => ({
  shouldRunBackgroundJobs: vi.fn(() => true),
  getClusterInstanceId: vi.fn(() => 0),
}));

describe('health routes', () => {
  beforeEach(() => {
    markApplicationStarting();
  });

  afterEach(() => {
    markApplicationStarting();
  });

  it('retorna 503 em /health/ready durante startup', async () => {
    const app = createApp();
    const response = await request(app.callback()).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('not_ready');
    expect(response.body.readiness).toBe('starting');
  });

  it('retorna 200 em /health/ready quando pronto e dependências ok', async () => {
    markApplicationReady();
    const app = createApp();

    const response = await request(app.callback()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
    expect(response.body.runsBackgroundJobs).toBe(true);
  });

  it('retorna 503 em /health quando unhealthy', async () => {
    markApplicationUnhealthy('MongoDB desconectado');
    const app = createApp();

    const response = await request(app.callback()).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('degraded');
    expect(response.body.unhealthyReason).toBe('MongoDB desconectado');
  });

  it('retorna 200 em /health/live enquanto processo não está em shutdown', async () => {
    markApplicationUnhealthy('falha temporária');
    const app = createApp();

    const response = await request(app.callback()).get('/health/live');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('alive');
  });

  it('retorna booleans seguros em /health/alerts sem secrets', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_FROM = 'noreply@syntra.app';
    process.env.VAPID_PUBLIC_KEY = 'public-key';
    process.env.VAPID_PRIVATE_KEY = 'private-key';
    process.env.VAPID_SUBJECT = 'mailto:support@syntra.app';

    const app = createApp();
    const response = await request(app.callback()).get('/health/alerts');

    expect(response.status).toBe(200);
    expect(response.body.emailConfigured).toBe(true);
    expect(response.body.vapidConfigured).toBe(true);
    expect(JSON.stringify(response.body)).not.toMatch(/private-key|smtp\.example\.com|noreply@/);
  });
});
