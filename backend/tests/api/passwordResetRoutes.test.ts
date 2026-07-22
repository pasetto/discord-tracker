import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/server';

const bridgeMocks = vi.hoisted(() => ({
  requestPublicPasswordReset: vi.fn(),
  completePasswordReset: vi.fn(),
  adminCreatePasswordReset: vi.fn(),
}));

vi.mock('../../src/services/betterAuthBridgeService', () => ({
  requestPublicPasswordReset: bridgeMocks.requestPublicPasswordReset,
  completePasswordReset: bridgeMocks.completePasswordReset,
  adminCreatePasswordReset: bridgeMocks.adminCreatePasswordReset,
}));

vi.mock('../../src/api/middleware/jwtAuth', () => ({
  jwtAuth: async (ctx: { state: Record<string, unknown> }, next: () => Promise<void>) => {
    ctx.state.user = { id: 'admin-1', isSuperAdmin: true };
    await next();
  },
}));

vi.mock('../../src/api/middleware/superAdmin', () => ({
  superAdminMiddleware: async (_ctx: unknown, next: () => Promise<void>) => {
    await next();
  },
  getPlatformUserId: () => 'admin-1',
}));

describe('password reset routes', () => {
  beforeEach(() => {
    bridgeMocks.requestPublicPasswordReset.mockReset();
    bridgeMocks.completePasswordReset.mockReset();
    bridgeMocks.adminCreatePasswordReset.mockReset();
  });

  it('POST /auth/forgot-password retorna sucesso genérico', async () => {
    bridgeMocks.requestPublicPasswordReset.mockResolvedValue({ ok: true });
    const app = createApp();
    const response = await request(app.callback())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'user@test.com' });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(bridgeMocks.requestPublicPasswordReset).toHaveBeenCalledWith('user@test.com');
  });

  it('POST /auth/reset-password conclui reset', async () => {
    bridgeMocks.completePasswordReset.mockResolvedValue(undefined);
    const app = createApp();
    const response = await request(app.callback())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'tok', newPassword: 'senha-nova-123' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(bridgeMocks.completePasswordReset).toHaveBeenCalledWith({
      token: 'tok',
      newPassword: 'senha-nova-123',
    });
  });

  it('POST /auth/reset-password retorna 400 para token inválido', async () => {
    bridgeMocks.completePasswordReset.mockRejectedValue(
      new Error('Token de redefinição inválido ou expirado'),
    );
    const app = createApp();
    const response = await request(app.callback())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'bad', newPassword: 'senha-nova-123' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Token');
  });

  it('POST /admin/users/:id/password-reset devolve URL recuperável', async () => {
    bridgeMocks.adminCreatePasswordReset.mockResolvedValue({
      resetUrl: 'http://localhost:4200/reset-password?token=abc',
      expiresAt: '2026-07-22T16:00:00.000Z',
      emailed: true,
    });

    const app = createApp();
    const response = await request(app.callback())
      .post('/api/v1/admin/users/user-1/password-reset')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.resetUrl).toContain('token=abc');
    expect(response.body.emailed).toBe(true);
    expect(bridgeMocks.adminCreatePasswordReset).toHaveBeenCalledWith('user-1', 'admin-1');
  });

  it('POST /admin/users/:id/password-reset/resend regenera link', async () => {
    bridgeMocks.adminCreatePasswordReset.mockResolvedValue({
      resetUrl: 'http://localhost:4200/reset-password?token=def',
      expiresAt: '2026-07-22T17:00:00.000Z',
      emailed: false,
    });

    const app = createApp();
    const response = await request(app.callback())
      .post('/api/v1/admin/users/user-1/password-reset/resend')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.resetUrl).toContain('token=def');
    expect(response.body.emailed).toBe(false);
  });
});
