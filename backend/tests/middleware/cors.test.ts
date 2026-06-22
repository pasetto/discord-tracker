import type { Context } from 'koa';
import { describe, expect, it, vi } from 'vitest';
import { corsMiddleware } from '../../src/api/middleware/cors';

function createContext(origin: string | undefined, method = 'GET'): Context {
  const setMock = vi.fn();

  return {
    method,
    status: 200,
    set: setMock,
    get: vi.fn((headerName: string) => (headerName === 'Origin' ? origin : undefined)),
  } as unknown as Context;
}

describe('corsMiddleware', () => {
  it('aplica headers de CORS para origem permitida', async () => {
    const ctx = createContext('http://localhost:4200');
    const next = vi.fn().mockResolvedValue(undefined);

    await corsMiddleware(ctx, next);

    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:4200');
    expect(ctx.set).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
    expect(next).toHaveBeenCalledOnce();
  });

  it('retorna 204 em preflight OPTIONS', async () => {
    const ctx = createContext('http://localhost:4200', 'OPTIONS');
    const next = vi.fn();

    await corsMiddleware(ctx, next);

    expect(ctx.status).toBe(204);
    expect(next).not.toHaveBeenCalled();
  });
});
