/**
 * Pure matchers for pilot smoke/e2e tenant cleanup (SYN-97).
 * Shared by the ops script and unit tests — no Mongo I/O here.
 */

/** Slugs that must never be deleted even if a smoke user has membership. */
export const PROTECTED_ORG_SLUGS = new Set(['econdos-sistemas']);

/** Exact emails that must never be deleted. */
export const PROTECTED_USER_EMAILS = new Set(['bootstrap@syntra.local']);

/**
 * @param {string | null | undefined} email
 * @returns {boolean}
 */
export function isProtectedUserEmail(email) {
  return PROTECTED_USER_EMAILS.has(String(email || '').trim().toLowerCase());
}

/**
 * @param {string | null | undefined} slug
 * @returns {boolean}
 */
export function isProtectedOrgSlug(slug) {
  return PROTECTED_ORG_SLUGS.has(String(slug || '').trim().toLowerCase());
}

/**
 * User is a smoke/e2e residual eligible for cleanup.
 * @param {{ email?: string, displayName?: string, isSuperAdmin?: boolean }} user
 * @returns {boolean}
 */
export function isSmokeE2eUser(user) {
  if (!user || user.isSuperAdmin === true) return false;
  const email = String(user.email || '').trim().toLowerCase();
  if (!email || isProtectedUserEmail(email)) return false;
  if (/@syntra\.test$/i.test(email)) return true;
  if (/smoke/i.test(email)) return true;
  const displayName = String(user.displayName || '');
  if (/smoke|e2e/i.test(displayName) && !/bootstrap/i.test(email)) return true;
  return false;
}

/**
 * Organization name/slug looks like smoke/e2e residual.
 * @param {{ name?: string, slug?: string }} org
 * @returns {boolean}
 */
export function isSmokeE2eOrg(org) {
  if (!org) return false;
  if (isProtectedOrgSlug(org.slug)) return false;
  const slug = String(org.slug || '');
  const name = String(org.name || '');
  if (/smoke|e2e|teste|(^|-)test($|-)|test-/i.test(slug)) return true;
  if (/smoke|e2e|teste|\btest\b|syntra e2e/i.test(name)) return true;
  return false;
}

/**
 * Build delete sets from audited user/org docs.
 * @param {{ users: object[], organizations: object[] }} input
 * @returns {{
 *   usersToDelete: object[],
 *   orgsToDelete: object[],
 *   preservedOrgIds: string[],
 *   skippedUsers: object[],
 * }}
 */
export function selectCleanupTargets({ users, organizations }) {
  const usersToDelete = (users || []).filter(isSmokeE2eUser);
  const skippedUsers = (users || []).filter((u) => !isSmokeE2eUser(u));

  const orgById = new Map((organizations || []).map((o) => [String(o._id), o]));
  const orgsToDelete = (organizations || []).filter(isSmokeE2eOrg);
  const deleteOrgIds = new Set(orgsToDelete.map((o) => String(o._id)));

  /** Orgs referenced by smoke users but not selected for delete (must preserve). */
  const preservedOrgIds = [
    ...new Set(
      usersToDelete.flatMap((u) =>
        (u.memberships || [])
          .map((m) => String(m.organizationId || ''))
          .filter((id) => id && !deleteOrgIds.has(id)),
      ),
    ),
  ];

  // Safety: never include protected orgs even if somehow flagged
  for (const org of orgsToDelete) {
    if (isProtectedOrgSlug(org.slug)) {
      throw new Error(`Protected org selected for delete: ${org.slug}`);
    }
  }

  for (const id of preservedOrgIds) {
    const org = orgById.get(id);
    if (org && isSmokeE2eOrg(org)) {
      // Should have been in delete set — consistency check only
      continue;
    }
  }

  return { usersToDelete, orgsToDelete, preservedOrgIds, skippedUsers };
}
