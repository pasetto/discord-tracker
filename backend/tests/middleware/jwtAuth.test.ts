import type { Context } from 'koa';
import { describe, expect, it, vi } from 'vitest';

const verifyAccessTokenMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/services/authService', () => ({
  verifyAccessToken: verifyAccessTokenMock,
}));

import { jwtAuth } from '../../src/api/middleware/jwtAuth';

function createContext(authorization: string | undefined): Context {
  return {
    state: {},
    status: 200,
    body: undefined,
    get: vi.fn((headerName: string) => (headerName === 'Authorization' ? authorization : undefined)),
  } as unknown as Context;
}

describe('jwtAuth middleware', () => {
  it('retorna 401 sem bearer token', async () => {
    const ctx = createContext(undefined);
    const next = vi.fn();

    await jwtAuth(ctx, next);

    expect(ctx.status).toBe(401);
    expect(ctx.body).toMatchObject({
      error: 'Não autorizado',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('injeta usuário autenticado em ctx.state quando JWT é válido', async () => {
    const ctx = createContext('Bearer valid.jwt.token');
    const next = vi.fn().mockResolvedValue(undefined);
    verifyAccessTokenMock.mockReturnValue({ id: 'user-1', organizationId: 'org-1' });

    await jwtAuth(ctx, next);

    expect(verifyAccessTokenMock).toHaveBeenCalledWith('valid.jwt.token');
    expect(ctx.state.user).toEqual({ id: 'user-1', organizationId: 'org-1' });
    expect(next).toHaveBeenCalledOnce();
  });

  it('retorna 401 quando token é inválido', async () => {
    const ctx = createContext('Bearer invalid');
    const next = vi.fn();
    verifyAccessTokenMock.mockImplementation(() => {
      throw new Error('invalid');
    });

    await jwtAuth(ctx, next);

    expect(ctx.status).toBe(401);
    expect(ctx.body).toMatchObject({
      message: 'JWT inválido ou expirado',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
