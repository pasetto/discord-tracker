import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/api/server';

const platformAuthMocks = vi.hoisted(() => ({
  registerPlatformUser: vi.fn(),
  loginPlatformUser: vi.fn(),
  refreshPlatformUserSession: vi.fn(),
}));

vi.mock('../../src/services/platformAuthService', () => ({
  registerPlatformUser: platformAuthMocks.registerPlatformUser,
  loginPlatformUser: platformAuthMocks.loginPlatformUser,
  refreshPlatformUserSession: platformAuthMocks.refreshPlatformUserSession,
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
});
