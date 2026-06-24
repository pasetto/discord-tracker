import Router from '@koa/router';
import { describe, expect, it } from 'vitest';
import { assertManagerRole, assertViewerReadRole, getMembershipRole } from '../../../src/api/middleware/tenantRbac';

/**
 * Cria contexto Koa mínimo para validar helpers de RBAC tenant.
 * @param role Papel do membership para a organização padrão
 * @returns Contexto mockado com `state.user.memberships` e `ctx.throw`
 */
function createContext(role?: string): Router.RouterContext {
  return {
    state: {
      user: {
        memberships: role ? [{ organizationId: 'org-1', role }] : [],
      },
    },
    throw(status: number, message?: string) {
      const error = new Error(message ?? 'erro') as Error & { status?: number };
      error.status = status;
      throw error;
    },
  } as unknown as Router.RouterContext;
}

describe('tenantRbac middleware helpers', () => {
  it('resolve role normalizada pelo getMembershipRole', () => {
    const ctx = createContext('MANAGER');
    const role = getMembershipRole(ctx, 'org-1');
    expect(role).toBe('manager');
  });

  it('bloqueia manager assertion para viewer', () => {
    const ctx = createContext('viewer');
    expect(() => assertManagerRole(ctx, 'org-1')).toThrowError(/Permissão insuficiente/);
  });

  it('permite leitura para viewer em assertViewerReadRole', () => {
    const ctx = createContext('viewer');
    expect(() => assertViewerReadRole(ctx, 'org-1')).not.toThrow();
  });

  it('bloqueia leitura quando membership está ausente', () => {
    const ctx = createContext();
    expect(() => assertViewerReadRole(ctx, 'org-1')).toThrowError(/Permissão insuficiente/);
  });
});
