import { describe, it, expect } from 'vitest';
import { Context, Next } from 'koa';
import { assertOrgMembership, tenantMiddleware } from '../../src/api/middleware/tenant';

describe('assertOrgMembership', () => {
  it('lança 403 quando user não pertence à org', () => {
    const user = { memberships: [{ organizationId: 'org-a', role: 'admin' }] };
    expect(() => assertOrgMembership(user, 'org-b')).toThrow(/403/);
  });

  it('não lança erro quando user pertence à org', () => {
    const user = {
      memberships: [
        { organizationId: 'org-a', role: 'member' },
        { organizationId: 'org-b', role: 'admin' },
      ],
    };

    expect(() => assertOrgMembership(user, 'org-b')).not.toThrow();
  });

  it('lança 403 quando membership está pendente', () => {
    const user = {
      memberships: [{ organizationId: 'org-a', role: 'admin', status: 'pending' as const }],
    };

    expect(() => assertOrgMembership(user, 'org-a')).toThrow(/pending approval/);
  });
});

describe('tenantMiddleware', () => {
  it('injeta organizationId no state quando membership é válido', async () => {
    const ctx = {
      query: { organizationId: 'org-a' },
      state: {
        user: {
          id: 'user-1',
          memberships: [{ organizationId: 'org-a', role: 'admin' }],
        },
      },
    } as unknown as Context;

    let nextCalled = false;
    const next: Next = async () => {
      nextCalled = true;
    };

    await tenantMiddleware(ctx, next);

    expect(ctx.state.organizationId).toBe('org-a');
    expect(nextCalled).toBe(true);
  });

  it('lança 400 quando organizationId não é informado', async () => {
    const ctx = {
      query: {},
      state: {
        user: {
          id: 'user-1',
          memberships: [{ organizationId: 'org-a', role: 'admin' }],
        },
      },
    } as unknown as Context;

    const next: Next = async () => {};

    await tenantMiddleware(ctx, next);

    expect(ctx.status).toBe(400);
    expect(ctx.body).toEqual({ error: 'Bad Request: organizationId is required' });
  });

  it('lança 403 quando user não pertence à organizationId', async () => {
    const ctx = {
      query: { organizationId: 'org-b' },
      state: {
        user: {
          id: 'user-1',
          memberships: [{ organizationId: 'org-a', role: 'admin' }],
        },
      },
    } as unknown as Context;

    const next: Next = async () => {};

    await tenantMiddleware(ctx, next);

    expect(ctx.status).toBe(403);
    expect(ctx.body).toEqual({ error: 'Forbidden: user is not member of this organization' });
  });
});
