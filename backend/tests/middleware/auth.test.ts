import type { Context } from 'koa';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerWarnMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/logger', () => ({
  createLogger: vi.fn(() => ({
    warn: loggerWarnMock,
  })),
}));

import { authMiddleware, extractApiKey, isValidApiKey } from '../../src/api/middleware/auth';

function createContext(headers: Record<string, string | undefined>, path = '/private'): Context {
  return {
    path,
    ip: '127.0.0.1',
    headers,
    status: 200,
    body: undefined,
  } as unknown as Context;
}

describe('auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('valida api key recebida por Authorization Bearer', () => {
    const ctx = createContext({ authorization: 'Bearer test-api-key' });

    expect(extractApiKey(ctx)).toBe('test-api-key');
    expect(isValidApiKey('test-api-key')).toBe(true);
  });

  it('extrai api key de header x-api-key ou cookie legado', () => {
    const headerContext = createContext({ 'x-api-key': ' another-key ' });
    expect(extractApiKey(headerContext)).toBe('another-key');

    const cookieContext = createContext({ cookie: 'tracker_api_key=test-api-key' });
    expect(extractApiKey(cookieContext)).toBe('test-api-key');
  });

  it('retorna 401 para rota privada sem api key válida', async () => {
    const ctx = createContext({});
    const next = vi.fn();

    await authMiddleware(ctx, next);

    expect(ctx.status).toBe(401);
    expect(ctx.body).toMatchObject({
      error: 'Não autorizado',
    });
    expect(next).not.toHaveBeenCalled();
    expect(loggerWarnMock).toHaveBeenCalled();
  });

  it('permite rota pública sem autenticação', async () => {
    const ctx = createContext({}, '/health');
    const next = vi.fn().mockResolvedValue(undefined);

    await authMiddleware(ctx, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
