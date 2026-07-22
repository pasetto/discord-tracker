import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isSmokeE2eUser,
  isSmokeE2eOrg,
  selectCleanupTargets,
  isProtectedOrgSlug,
} from './pilotSmokeTenantMatch.mjs';

describe('pilotSmokeTenantMatch', () => {
  it('matches e2e@syntra.test users and rejects bootstrap/super-admin', () => {
    assert.equal(
      isSmokeE2eUser({ email: 'e2e+quem-sumiu-1@syntra.test', isSuperAdmin: false }),
      true,
    );
    assert.equal(
      isSmokeE2eUser({ email: 'smoke.syn47@syntra-pilot.test', displayName: 'Smoke', isSuperAdmin: false }),
      true,
    );
    assert.equal(
      isSmokeE2eUser({ email: 'smoke-syn53@syntra.local', displayName: 'Smoke SYN-53', isSuperAdmin: false }),
      true,
    );
    assert.equal(isSmokeE2eUser({ email: 'bootstrap@syntra.local', isSuperAdmin: false }), false);
    assert.equal(
      isSmokeE2eUser({ email: 'e2e+x@syntra.test', isSuperAdmin: true }),
      false,
    );
    assert.equal(isSmokeE2eUser({ email: 'ceo@econdos.com.br', displayName: 'CEO' }), false);
  });

  it('matches smoke/e2e orgs and protects econdos-sistemas', () => {
    assert.equal(isSmokeE2eOrg({ name: 'Syntra E2E 123', slug: 'syntra-e2e-123' }), true);
    assert.equal(isSmokeE2eOrg({ name: 'Smoke Org', slug: 'smoke-org' }), true);
    assert.equal(isProtectedOrgSlug('econdos-sistemas'), true);
    assert.equal(
      isSmokeE2eOrg({ name: 'eCondos Sistemas', slug: 'econdos-sistemas' }),
      false,
    );
  });

  it('preserves non-smoke org linked from smoke user membership', () => {
    const result = selectCleanupTargets({
      users: [
        {
          _id: 'u1',
          email: 'smoke-syn53@syntra.local',
          isSuperAdmin: false,
          memberships: [
            { organizationId: 'smoke-org', role: 'owner' },
            { organizationId: 'real-org', role: 'admin' },
          ],
        },
      ],
      organizations: [
        { _id: 'smoke-org', name: 'Smoke SYN53', slug: 'smoke-syn53' },
        { _id: 'real-org', name: 'eCondos Sistemas', slug: 'econdos-sistemas' },
      ],
    });

    assert.equal(result.usersToDelete.length, 1);
    assert.deepEqual(
      result.orgsToDelete.map((o) => o._id),
      ['smoke-org'],
    );
    assert.deepEqual(result.preservedOrgIds, ['real-org']);
  });
});
