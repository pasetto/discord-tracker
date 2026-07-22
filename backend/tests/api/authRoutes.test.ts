import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/server';

const platformAuthMocks = vi.hoisted(() => ({
  registerPlatformUser: vi.fn(),
  loginPlatformUser: vi.fn(),
  refreshPlatformUserSession: vi.fn(),
}));

const passwordResetMocks = vi.hoisted(() => ({
  requestPublicPasswordReset: vi.fn(),
  completePasswordReset: vi.fn(),
}));

vi.mock('../../src/services/platformAuthService', () => ({
  registerPlatformUser: platformAuthMocks.registerPlatformUser,
  loginPlatformUser: platformAuthMocks.loginPlatformUser,
  refreshPlatformUserSession: platformAuthMocks.refreshPlatformUserSession,
}));

vi.mock('../../src/services/betterAuthBridgeService', () => ({
  requestPublicPasswordReset: passwordResetMocks.requestPublicPasswordReset,
  completePasswordReset: passwordResetMocks.completePasswordReset,
}));

describe('auth routes', () => {
  it('cadastra usuário em POST /api/v1/auth/register', async () => {
    platformAuthMocks.registerPlatformUser.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        email: 'owner@test.com',
        displayName: 'Owner',
        memberships: [{ organizationId: 'org-1', role: 'owner' }],
      },
      organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
    });

    const app = createApp();
    const response = await request(app.callback())
      .post('/api/v1/auth/register')
      .send({
        email: 'owner@test.com',
        password: 'senha-segura',
        displayName: 'Owner',
        organizationName: 'Test Org',
      });

    expect(response.status).toBe(201);
    expect(response.body.accessToken).toBe('access-token');
    expect(response.body.user.email).toBe('owner@test.com');
    expect(response.headers['set-cookie']?.[0]).toContain('syntra_refresh');
  });

  it('repassa inviteCode no cadastro via convite', async () => {
    platformAuthMocks.registerPlatformUser.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-2',
        email: 'convidado@test.com',
        displayName: 'Convidado',
        memberships: [{ organizationId: 'org-1', role: 'viewer', status: 'pending' }],
      },
      organization: null,
      organizations: [{ id: 'org-1', name: 'Econdos', slug: 'econdos', role: 'viewer', status: 'pending' }],
    });

    const app = createApp();
    const response = await request(app.callback())
      .post('/api/v1/auth/register')
      .send({
        email: 'convidado@test.com',
        password: 'senha-segura',
        displayName: 'Convidado',
        inviteCode: 'VB87T6AZ',
      });

    expect(response.status).toBe(201);
    expect(platformAuthMocks.registerPlatformUser).toHaveBeenCalledWith({
      email: 'convidado@test.com',
      password: 'senha-segura',
      displayName: 'Convidado',
      organizationName: undefined,
      inviteCode: 'VB87T6AZ',
    });
    expect(response.body.organization).toBeNull();
    expect(response.body.organizations[0].status).toBe('pending');
  });

  it('autentica usuário em POST /api/v1/auth/login', async () => {
    platformAuthMocks.loginPlatformUser.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        email: 'owner@test.com',
        displayName: 'Owner',
        memberships: [{ organizationId: 'org-1', role: 'owner' }],
      },
      organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
    });

    const app = createApp();
    const response = await request(app.callback())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@test.com', password: 'senha-segura' });

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBe('access-token');
    expect(response.body.organization.id).toBe('org-1');
    expect(response.headers['set-cookie']?.[0]).toContain('syntra_refresh');
  });

  it('usa cookie de sessão quando rememberMe é false no login', async () => {
    platformAuthMocks.loginPlatformUser.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'user-1',
        email: 'owner@test.com',
        displayName: 'Owner',
        memberships: [{ organizationId: 'org-1', role: 'owner' }],
      },
      organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
    });

    const app = createApp();
    const response = await request(app.callback())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@test.com', password: 'senha-segura', rememberMe: false });

    expect(response.status).toBe(200);
    const cookieHeader = response.headers['set-cookie']?.[0] ?? '';
    expect(cookieHeader).toContain('syntra_refresh');
    expect(cookieHeader.toLowerCase()).not.toContain('max-age');
  });

  it('retorna 401 para credenciais inválidas', async () => {
    platformAuthMocks.loginPlatformUser.mockRejectedValue(new Error('Credenciais inválidas'));

    const app = createApp();
    const response = await request(app.callback())
      .post('/api/v1/auth/login')
      .send({ email: 'owner@test.com', password: 'errada' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Credenciais inválidas');
  });

  it('encerra sessão em POST /api/v1/auth/logout', async () => {
    const app = createApp();
    const response = await request(app.callback()).post('/api/v1/auth/logout');

    expect(response.status).toBe(204);
    expect(response.headers['set-cookie']?.[0]).toContain('syntra_refresh=;');
  });

  it('renova access token em POST /api/v1/auth/refresh com cookie válido', async () => {
    platformAuthMocks.refreshPlatformUserSession.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      user: {
        id: 'user-1',
        email: 'owner@test.com',
        displayName: 'Owner',
        memberships: [{ organizationId: 'org-1', role: 'owner' }],
      },
      organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
    });

    const app = createApp();
    const response = await request(app.callback())
      .post('/api/v1/auth/refresh')
      .set('Cookie', ['syntra_refresh=refresh-token']);

    expect(response.status).toBe(200);
    expect(response.body.accessToken).toBe('new-access-token');
    expect(platformAuthMocks.refreshPlatformUserSession).toHaveBeenCalledWith('refresh-token');
  });

  it('retorna 401 em POST /api/v1/auth/refresh sem cookie', async () => {
    const app = createApp();
    const response = await request(app.callback()).post('/api/v1/auth/refresh');

    expect(response.status).toBe(401);
    expect(response.body.message).toContain('Sessão expirada');
  });

  it('retorna 401 ao acessar relatório diário sem JWT', async () => {
    const app = createApp();

    const response = await request(app.callback()).get('/api/v1/org/org-1/reports/daily');

    expect(response.status).toBe(401);
  });

  it('aceita POST /api/v1/auth/forgot-password com resposta genérica', async () => {
    passwordResetMocks.requestPublicPasswordReset.mockResolvedValue({ ok: true });
    const app = createApp();
    const response = await request(app.callback())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'owner@test.com' });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(passwordResetMocks.requestPublicPasswordReset).toHaveBeenCalledWith('owner@test.com');
  });

  it('aceita POST /api/v1/auth/reset-password com token válido', async () => {
    passwordResetMocks.completePasswordReset.mockResolvedValue(undefined);
    const app = createApp();
    const response = await request(app.callback())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'tok', newPassword: 'nova-senha-123' });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(passwordResetMocks.completePasswordReset).toHaveBeenCalledWith({
      token: 'tok',
      newPassword: 'nova-senha-123',
    });
  });

  it('retorna 400 em reset-password com token inválido', async () => {
    passwordResetMocks.completePasswordReset.mockRejectedValue(new Error('Token de redefinição inválido ou expirado'));
    const app = createApp();
    const response = await request(app.callback())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'bad', newPassword: 'nova-senha-123' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('inválido');
  });
});
