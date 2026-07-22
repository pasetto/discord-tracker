#!/usr/bin/env node
/**
 * Ops (piloto): dry-run + delete dos tenants smoke/e2e no Mongo do host Prod (SYN-97).
 *
 * Segurança:
 * - Default MODE=dry_run (sem writes)
 * - Execute exige CONFIRM_DELETE=DELETE_SMOKE_E2E
 * - Nunca apaga bootstrap@syntra.local, isSuperAdmin, ou slug econdos-sistemas
 * - Só apaga orgs que passam no matcher smoke/e2e (não apaga tenant real ligado a smoke user)
 *
 * Env:
 * - MONGODB_URI (dotenv do deploy: prefer backend/.env)
 * - MODE=dry_run|execute
 * - CONFIRM_DELETE=DELETE_SMOKE_E2E (obrigatório em execute)
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { selectCleanupTargets } from './lib/pilotSmokeTenantMatch.mjs';

/**
 * Carrega MongoClient/ObjectId via `mongodb` direto ou fallback `mongoose.mongo`
 * (no piloto o driver costuma estar aninhado em mongoose, não hoisted).
 * @returns {{ MongoClient: typeof import('mongodb').MongoClient, ObjectId: typeof import('mongodb').ObjectId }}
 */
function loadMongodb() {
  const bases = [
    resolve(process.cwd(), 'backend'),
    process.cwd(),
    resolve(process.cwd(), 'node_modules/mongodb'),
    resolve(process.cwd(), 'backend/node_modules/mongodb'),
  ];
  /** @type {string[]} */
  const errors = [];

  /**
   * @param {string} pkgJson
   * @returns {{ MongoClient: unknown, ObjectId: unknown } | null}
   */
  function tryFromPackageJson(pkgJson) {
    const requireFrom = createRequire(pkgJson);
    try {
      const mod = requireFrom('mongodb');
      if (mod?.MongoClient && mod?.ObjectId) {
        return { MongoClient: mod.MongoClient, ObjectId: mod.ObjectId };
      }
      errors.push(`${pkgJson}: mongodb sem MongoClient/ObjectId`);
    } catch (err) {
      errors.push(`${pkgJson} mongodb: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      const mongoose = requireFrom('mongoose');
      const MongoClient = mongoose?.mongo?.MongoClient;
      const ObjectId = mongoose?.Types?.ObjectId || mongoose?.mongo?.ObjectId;
      if (MongoClient && ObjectId) {
        return { MongoClient, ObjectId };
      }
      // nested: require mongodb from mongoose install path
      const mongooseEntry = requireFrom.resolve('mongoose');
      const nested = createRequire(mongooseEntry)('mongodb');
      if (nested?.MongoClient && nested?.ObjectId) {
        return { MongoClient: nested.MongoClient, ObjectId: nested.ObjectId };
      }
      errors.push(`${pkgJson}: mongoose sem MongoClient/ObjectId`);
    } catch (err) {
      errors.push(`${pkgJson} mongoose: ${err instanceof Error ? err.message : String(err)}`);
    }
    return null;
  }

  for (const base of bases) {
    const pkgJson = existsSync(resolve(base, 'package.json'))
      ? resolve(base, 'package.json')
      : null;
    if (!pkgJson) {
      errors.push(`${base}: sem package.json`);
      continue;
    }
    const loaded = tryFromPackageJson(pkgJson);
    if (loaded) return /** @type {{ MongoClient: typeof import('mongodb').MongoClient, ObjectId: typeof import('mongodb').ObjectId }} */ (loaded);
  }
  throw new Error(`mongodb não encontrado. Tentativas: ${errors.join(' | ')}`);
}

const { MongoClient, ObjectId } = loadMongodb();

/**
 * Carrega pares KEY=VALUE de um arquivo dotenv sem sobrescrever env já definida.
 * @param {string} filePath Caminho do .env
 * @returns {void}
 */
function loadDotEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

/**
 * Força MONGODB_URI a partir de backend/.env quando presente (mesmo padrão do audit).
 * @param {string} deployRoot
 * @returns {void}
 */
function preferBackendMongoUri(deployRoot) {
  const backendEnvPath = resolve(deployRoot, 'backend/.env');
  if (!existsSync(backendEnvPath)) return;
  const text = readFileSync(backendEnvPath, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const keyName = line.slice(0, eq).trim();
    if (keyName !== 'MONGODB_URI') continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env.MONGODB_URI = value;
  }
}

/**
 * @param {import('mongodb').Db} db
 * @param {string[]} preferred
 * @param {string} needle
 * @returns {Promise<string>}
 */
async function resolveCollectionName(db, preferred, needle) {
  const names = (await db.listCollections().toArray()).map((c) => c.name);
  for (const name of preferred) {
    if (names.includes(name)) return name;
  }
  const fuzzy = names.find((n) => n.toLowerCase().includes(needle.toLowerCase()));
  if (fuzzy) return fuzzy;
  throw new Error(`Collection não encontrada (${needle}). Disponíveis: ${names.join(', ')}`);
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function serialize(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && '_bsontype' in value) {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serialize(v);
    }
    return out;
  }
  return value;
}

/** Collections tenant conhecidas (além de scan dinâmico). */
const KNOWN_TENANT_COLLECTIONS = [
  'guildconnections',
  'guild_connections',
  'channelrules',
  'channel_rules',
  'trackedusers',
  'tracked_users',
  'membercategories',
  'member_categories',
  'workcalendars',
  'work_calendars',
  'plannedabsences',
  'planned_absences',
  'inactivitysettings',
  'inactivity_settings',
  'inactivitysnapshots',
  'inactivity_snapshots',
  'intradayalertdispatches',
  'intraday_alert_dispatches',
  'usercollaborationgoals',
  'user_collaboration_goals',
  'categorygoaltemplates',
  'category_goal_templates',
  'gamificationsettings',
  'gamification_settings',
  'presencesessions',
  'presence_sessions',
  'voicesessions',
  'voice_sessions',
  'voicechanneltransitions',
  'voice_channel_transitions',
  'textactivityevents',
  'text_activity_events',
  'pushsubscriptions',
  'push_subscriptions',
  'webhookendpoints',
  'webhook_endpoints',
  'webhookdeliveries',
  'webhook_deliveries',
  'auditlogs',
  'audit_logs',
  'dailyreports',
  'daily_reports',
  'discordapplications',
  'discord_applications',
];

/**
 * @param {import('mongodb').Db} db
 * @param {import('mongodb').ObjectId[]} orgObjectIds
 * @returns {Promise<Record<string, number>>}
 */
async function countTenantDocsByCollection(db, orgObjectIds) {
  const names = (await db.listCollections().toArray()).map((c) => c.name);
  /** @type {Record<string, number>} */
  const counts = {};
  const candidates = new Set([
    ...KNOWN_TENANT_COLLECTIONS.filter((n) => names.includes(n)),
    ...names.filter((n) => /guild|channel|tracked|absence|inactiv|goal|gamif|presence|voice|text|webhook|push|audit|calendar|category/i.test(n)),
  ]);

  for (const name of candidates) {
    if (name === 'organizations' || name === 'platformusers' || name === 'plans') continue;
    try {
      const n = await db.collection(name).countDocuments({
        organizationId: { $in: orgObjectIds },
      });
      if (n > 0) counts[name] = n;
    } catch {
      // ignore collections without organizationId index/type mismatch
    }
  }
  return counts;
}

/**
 * @returns {Promise<void>}
 */
async function main() {
  const mode = String(process.env.MODE || 'dry_run').trim().toLowerCase();
  if (mode !== 'dry_run' && mode !== 'execute') {
    throw new Error(`MODE inválido: ${mode} (use dry_run|execute)`);
  }
  if (mode === 'execute' && process.env.CONFIRM_DELETE !== 'DELETE_SMOKE_E2E') {
    throw new Error('Execute bloqueado: defina CONFIRM_DELETE=DELETE_SMOKE_E2E');
  }

  const deployRoot = process.cwd();
  loadDotEnvFile(resolve(deployRoot, 'backend/.env'));
  loadDotEnvFile(resolve(deployRoot, '.env'));
  preferBackendMongoUri(deployRoot);

  const mongoUri = process.env.MONGODB_URI?.trim();
  if (!mongoUri) throw new Error('MONGODB_URI ausente no host');

  const client = new MongoClient(mongoUri, { readPreference: 'primaryPreferred' });
  await client.connect();
  const db = client.db();

  try {
    const orgCol = await resolveCollectionName(db, ['organizations', 'organization'], 'organization');
    const usersCol = await resolveCollectionName(
      db,
      ['platformusers', 'platform_users', 'PlatformUser'],
      'platformuser',
    );

    const userFilter = {
      $or: [
        { email: /@syntra\.test$/i },
        { email: /smoke/i },
        { displayName: /smoke|e2e/i },
      ],
    };
    const orgFilter = {
      $or: [
        { slug: /smoke|e2e|teste|(^|-)test($|-)|test-/i },
        { name: /smoke|e2e|teste|\btest\b|syntra e2e/i },
      ],
    };

    const [orgsTotalBefore, usersTotalBefore, candidateUsers, candidateOrgs] = await Promise.all([
      db.collection(orgCol).countDocuments({}),
      db.collection(usersCol).countDocuments({}),
      db
        .collection(usersCol)
        .find(userFilter, {
          projection: {
            email: 1,
            displayName: 1,
            isSuperAdmin: 1,
            memberships: 1,
            createdAt: 1,
          },
        })
        .limit(500)
        .toArray(),
      db
        .collection(orgCol)
        .find(orgFilter, {
          projection: { name: 1, slug: 1, createdAt: 1, 'subscription.status': 1 },
        })
        .limit(500)
        .toArray(),
    ]);

    // Also load orgs referenced by memberships (to detect preserved real tenants)
    const membershipOrgIds = [
      ...new Set(
        candidateUsers.flatMap((u) =>
          (u.memberships || []).map((m) => String(m.organizationId)).filter(Boolean),
        ),
      ),
    ];
    const membershipOrgs =
      membershipOrgIds.length === 0
        ? []
        : await db
            .collection(orgCol)
            .find(
              { _id: { $in: membershipOrgIds.map((id) => new ObjectId(id)) } },
              { projection: { name: 1, slug: 1, createdAt: 1, 'subscription.status': 1 } },
            )
            .toArray();

    const orgMap = new Map();
    for (const o of [...candidateOrgs, ...membershipOrgs]) {
      orgMap.set(String(o._id), o);
    }

    const selected = selectCleanupTargets({
      users: candidateUsers,
      organizations: [...orgMap.values()],
    });

    const orgObjectIds = selected.orgsToDelete.map((o) => new ObjectId(String(o._id)));
    const userObjectIds = selected.usersToDelete.map((u) => new ObjectId(String(u._id)));
    const tenantDocCounts = orgObjectIds.length
      ? await countTenantDocsByCollection(db, orgObjectIds)
      : {};

    const dryRunReport = {
      ranAt: new Date().toISOString(),
      mode,
      database: db.databaseName,
      collections: { organizations: orgCol, platformUsers: usersCol },
      before: {
        organizations: orgsTotalBefore,
        platformUsers: usersTotalBefore,
      },
      planned: {
        usersToDelete: selected.usersToDelete.length,
        orgsToDelete: selected.orgsToDelete.length,
        preservedOrgIds: selected.preservedOrgIds,
        tenantDocsByCollection: tenantDocCounts,
      },
      users: serialize(
        selected.usersToDelete.map((u) => ({
          _id: u._id,
          email: u.email,
          displayName: u.displayName,
          isSuperAdmin: u.isSuperAdmin,
          membershipOrgIds: (u.memberships || []).map((m) => String(m.organizationId)),
        })),
      ),
      organizations: serialize(
        selected.orgsToDelete.map((o) => ({
          _id: o._id,
          name: o.name,
          slug: o.slug,
        })),
      ),
      preservedOrganizations: serialize(
        selected.preservedOrgIds.map((id) => {
          const o = orgMap.get(id);
          return o
            ? { _id: o._id, name: o.name, slug: o.slug }
            : { _id: id, name: null, slug: null };
        }),
      ),
      notes: [
        'Filtros alinhados ao audit SYN-94; matcher puro em scripts/lib/pilotSmokeTenantMatch.mjs',
        'econdos-sistemas / bootstrap / super-admin nunca deletados',
        mode === 'dry_run' ? 'DRY-RUN: nenhum delete executado' : 'EXECUTE: deletes aplicados',
      ],
    };

    console.log('=== SYN-97 cleanup-pilot-mongo-smoke PLAN ===');
    console.log(JSON.stringify(dryRunReport, null, 2));
    console.log('=== END PLAN ===');

    if (mode === 'dry_run') {
      return;
    }

    /** @type {Record<string, number>} */
    const deleted = {};

    for (const [colName, expected] of Object.entries(tenantDocCounts)) {
      const result = await db.collection(colName).deleteMany({
        organizationId: { $in: orgObjectIds },
      });
      deleted[colName] = result.deletedCount;
      if (expected > 0 && result.deletedCount === 0) {
        console.warn(`WARN: expected docs in ${colName} but deletedCount=0`);
      }
    }

    // Catch any remaining tenant docs not counted earlier
    const allNames = (await db.listCollections().toArray()).map((c) => c.name);
    for (const name of allNames) {
      if (deleted[name] != null) continue;
      if (name === orgCol || name === usersCol || name === 'plans') continue;
      try {
        const result = await db.collection(name).deleteMany({
          organizationId: { $in: orgObjectIds },
        });
        if (result.deletedCount > 0) deleted[name] = result.deletedCount;
      } catch {
        // skip
      }
    }

    if (orgObjectIds.length) {
      const orgResult = await db.collection(orgCol).deleteMany({ _id: { $in: orgObjectIds } });
      deleted[orgCol] = orgResult.deletedCount;
    }

    if (userObjectIds.length) {
      const userResult = await db.collection(usersCol).deleteMany({ _id: { $in: userObjectIds } });
      deleted[usersCol] = userResult.deletedCount;
    }

    // Strip stale memberships on remaining users pointing at deleted orgs
    if (orgObjectIds.length) {
      await db.collection(usersCol).updateMany(
        { 'memberships.organizationId': { $in: orgObjectIds } },
        { $pull: { memberships: { organizationId: { $in: orgObjectIds } } } },
      );
    }

    const [orgsTotalAfter, usersTotalAfter, remainingSmokeUsers, remainingSmokeOrgs] =
      await Promise.all([
        db.collection(orgCol).countDocuments({}),
        db.collection(usersCol).countDocuments({}),
        db.collection(usersCol).countDocuments(userFilter),
        db.collection(orgCol).countDocuments(orgFilter),
      ]);

    // Verify protected org still exists
    const protectedOrg = await db.collection(orgCol).findOne(
      { slug: 'econdos-sistemas' },
      { projection: { name: 1, slug: 1 } },
    );

    const executeReport = {
      ranAt: new Date().toISOString(),
      mode: 'execute',
      database: db.databaseName,
      before: dryRunReport.before,
      after: {
        organizations: orgsTotalAfter,
        platformUsers: usersTotalAfter,
        remainingSmokeLikeUsers: remainingSmokeUsers,
        remainingSmokeLikeOrgs: remainingSmokeOrgs,
      },
      deletedCounts: deleted,
      planned: dryRunReport.planned,
      protectedOrgStillPresent: Boolean(protectedOrg),
      protectedOrg: serialize(protectedOrg),
    };

    console.log('=== SYN-97 cleanup-pilot-mongo-smoke RESULT ===');
    console.log(JSON.stringify(executeReport, null, 2));
    console.log('=== END RESULT ===');

    if (!protectedOrg) {
      throw new Error('FATAL: econdos-sistemas ausente após cleanup — possível delete indevido');
    }
    if (executeReport.after.organizations < 1) {
      throw new Error('FATAL: zero organizations restantes');
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('CLEANUP_FAILED', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
