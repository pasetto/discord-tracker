import { describe, it, expect } from 'vitest';
import { isValidApiKey, extractApiKey } from '../src/api/middleware/auth';
import { Context } from 'koa';

describe('auth middleware', () => {
  it('valida API key correta', () => {
    expect(isValidApiKey('test-api-key')).toBe(true);
    expect(isValidApiKey('another-key')).toBe(true);
  });

  it('rejeita API key inválida', () => {
    expect(isValidApiKey('wrong-key')).toBe(false);
    expect(isValidApiKey(undefined)).toBe(false);
    expect(isValidApiKey('')).toBe(false);
  });

  it('extrai Bearer token do header Authorization', () => {
    const ctx = {
      headers: { authorization: 'Bearer minha-chave-secreta' },
    } as Context;

    expect(extractApiKey(ctx)).toBe('minha-chave-secreta');
  });

  it('extrai chave do header X-API-Key', () => {
    const ctx = {
      headers: { 'x-api-key': 'chave-header' },
    } as Context;

    expect(extractApiKey(ctx)).toBe('chave-header');
  });

  it('extrai chave do cookie tracker_api_key', () => {
    const ctx = {
      headers: { cookie: 'tracker_api_key=chave-cookie; outro=valor' },
    } as Context;

    expect(extractApiKey(ctx)).toBe('chave-cookie');
  });
});
