#!/usr/bin/env node
/**
 * Ops (piloto): auditoria somente leitura de orgs/users smoke, e2e@syntra.test
 * e bootstrap@syntra.local no Mongo do host Prod.
 *
 * Não imprime passwordHash nem secrets. Não apaga/atualiza nada.
 *
 * Env:
 * - MONGODB_URI (dotenv do deploy: prefer backend/.env)
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Resolve `mongoose` no monorepo (hoist na raiz ou em backend/).
 * @returns {typeof import('mongoose')}
 */
function loadMongoose() {
  const candidates = [
    resolve(process.cwd(), 'package.json'),
    resolve(process.cwd(), 'backend/package.json'),
  ];
  for (const pkg of candidates) {
    try {
      const requireFrom = createRequire(pkg);
      return requireFrom('mongoose');
    } catch {
      // tenta próximo candidato
    }
  }
  throw new Error('mongoose não encontrado (rode npm ci no deploy root)');
}

/** @type {typeof import('mongoose')} */
const mongoose = loadMongoose();

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
 * Escolhe collection pelo nome canônico ou pelo primeiro match parcial.
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
 * Serializa ObjectId / Date de forma estável para JSON.
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

/**
 * Ponto de entrada — somente leituras.
 * @returns {Promise<void>}
 */
async function main() {
  const deployRoot = process.cwd();
  loadDotEnvFile(resolve(deployRoot, 'backend/.env'));
  loadDotEnvFile(resolve(deployRoot, '.env'));

  const backendEnvPath = resolve(deployRoot, 'backend/.env');
  if (existsSync(backendEnvPath)) {
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

  const mongoUri = process.env.MONGODB_URI?.trim();
  if (!mongoUri) throw new Error('MONGODB_URI ausente no host');

  await mongoose.connect(mongoUri, { readPreference: 'primaryPreferred' });
  const db = mongoose.connection.db;
  if (!db) throw new Error('Conexão Mongo sem db');

  const orgCol = await resolveCollectionName(db, ['organizations', 'organization'], 'organization');
  const usersCol = await resolveCollectionName(
    db,
    ['platformusers', 'platform_users', 'PlatformUser'],
    'platformuser',
  );

  const userFilter = {
    $or: [
      { email: 'bootstrap@syntra.local' },
      { email: /@syntra\.test$/i },
      { email: /smoke/i },
      { displayName: /smoke|e2e|bootstrap/i },
    ],
  };

  const orgFilter = {
    $or: [
      { slug: /smoke|e2e|teste|(^|-)test($|-)|test-/i },
      { name: /smoke|e2e|teste|\btest\b|syntra e2e/i },
    ],
  };

  const [usersTotal, orgsTotal, flaggedUsers, flaggedOrgs] = await Promise.all([
    db.collection(usersCol).countDocuments({}),
    db.collection(orgCol).countDocuments({}),
    db
      .collection(usersCol)
      .find(userFilter, {
        projection: {
          email: 1,
          displayName: 1,
          isSuperAdmin: 1,
          discordId: 1,
          memberships: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .sort({ createdAt: 1 })
      .limit(500)
      .toArray(),
    db
      .collection(orgCol)
      .find(orgFilter, {
        projection: {
          name: 1,
          slug: 1,
          inviteCode: 1,
          'subscription.status': 1,
          'onboarding.currentStep': 1,
          createdAt: 1,
          updatedAt: 1,
        },
      })
      .sort({ createdAt: 1 })
      .limit(500)
      .toArray(),
  ]);

  const bootstrapExact = flaggedUsers.filter(
    (u) => String(u.email || '').toLowerCase() === 'bootstrap@syntra.local',
  );
  const syntraTestUsers = flaggedUsers.filter((u) =>
    /@syntra\.test$/i.test(String(u.email || '')),
  );
  const otherFlaggedUsers = flaggedUsers.filter((u) => {
    const email = String(u.email || '').toLowerCase();
    return email !== 'bootstrap@syntra.local' && !/@syntra\.test$/i.test(email);
  });

  const membershipOrgIds = [
    ...new Set(
      flaggedUsers.flatMap((u) =>
        (u.memberships || []).map((m) => String(m.organizationId)).filter(Boolean),
      ),
    ),
  ];

  let membershipOrgs = [];
  if (membershipOrgIds.length) {
    membershipOrgs = await db
      .collection(orgCol)
      .find(
        { _id: { $in: membershipOrgIds.map((id) => new mongoose.Types.ObjectId(id)) } },
        { projection: { name: 1, slug: 1, createdAt: 1, 'subscription.status': 1 } },
      )
      .toArray();
  }

  const report = {
    auditedAt: new Date().toISOString(),
    mode: 'read_only',
    database: db.databaseName,
    collections: { organizations: orgCol, platformUsers: usersCol },
    totals: {
      organizations: orgsTotal,
      platformUsers: usersTotal,
    },
    matches: {
      bootstrapAtSyntraLocal: {
        count: bootstrapExact.length,
        users: serialize(bootstrapExact),
      },
      emailAtSyntraTest: {
        count: syntraTestUsers.length,
        users: serialize(syntraTestUsers),
      },
      otherSmokeLikeUsers: {
        count: otherFlaggedUsers.length,
        users: serialize(otherFlaggedUsers),
      },
      smokeLikeOrganizations: {
        count: flaggedOrgs.length,
        organizations: serialize(flaggedOrgs),
      },
      orgsLinkedFromFlaggedUsers: {
        count: membershipOrgs.length,
        organizations: serialize(membershipOrgs),
      },
    },
    notes: [
      'Sem delete/update. passwordHash e secrets omitidos.',
      'Filtros: bootstrap@syntra.local, *@syntra.test, email/displayName com smoke|e2e|bootstrap; orgs name/slug smoke|e2e|teste|test (+ orgs das memberships dos users flagados).',
      'Limite 500 docs por lista.',
    ],
  };

  console.log('=== SYN-94 audit-pilot-mongo-smoke (READ ONLY) ===');
  console.log(JSON.stringify(report, null, 2));
  console.log('=== END AUDIT ===');
}

main()
  .catch((err) => {
    console.error('AUDIT_FAILED', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });
