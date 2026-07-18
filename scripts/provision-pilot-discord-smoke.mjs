#!/usr/bin/env node
/**
 * Ops (piloto): inspeciona guilds do bot + conexões existentes e, opcionalmente,
 * vincula um guild livre a uma organização smoke (GuildConnection ativa).
 *
 * Não imprime tokens Discord. Roda no host via workflow SSH (secrets Prod).
 *
 * Env:
 * - MONGODB_URI, ENCRYPTION_KEY (dotenv do deploy)
 * - SMOKE_ORG_ID (opcional): ObjectId da org a vincular
 * - SMOKE_GUILD_ID (opcional): guild específico; senão usa o primeiro livre
 * - SMOKE_USER_ID (opcional): selectedBy
 * - DRY_RUN=1 (default): só inspeciona; DRY_RUN=0 aplica vínculo
 */
import { createDecipheriv } from 'node:crypto';
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
 * Descriptografa payload AES-256-GCM no formato iv:authTag:cipherText.
 * @param {string} encryptedValue Valor cifrado
 * @param {Buffer} key Chave de 32 bytes
 * @returns {string} Texto puro
 */
function decryptSecret(encryptedValue, key) {
  const [ivBase64, authTagBase64, cipherTextBase64] = encryptedValue.split(':');
  if (!ivBase64 || !authTagBase64 || !cipherTextBase64) {
    throw new Error('Payload criptografado inválido');
  }
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');
  const cipherText = Buffer.from(cipherTextBase64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8');
}

/**
 * Lista guilds onde o bot está instalado (API Discord REST).
 * @param {string} botToken Token do bot
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
async function listBotGuilds(botToken) {
  const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
    headers: { Authorization: `Bot ${botToken}` },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord guilds HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
  /** @type {Array<{id: string, name: string}>} */
  const guilds = await response.json();
  return guilds.map((g) => ({ id: g.id, name: g.name }));
}

/**
 * Ponto de entrada do script de provisionamento.
 * @returns {Promise<void>}
 */
async function main() {
  const deployRoot = process.cwd();
  // Preferir backend/.env (SaaS multitenant); root .env pode apontar DB legado.
  loadDotEnvFile(resolve(deployRoot, 'backend/.env'));
  loadDotEnvFile(resolve(deployRoot, '.env'));

  // Se ambos existem, forçar MONGODB_URI/ENCRYPTION_KEY do backend quando presentes.
  const backendEnvPath = resolve(deployRoot, 'backend/.env');
  if (existsSync(backendEnvPath)) {
    const text = readFileSync(backendEnvPath, 'utf8');
    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const keyName = line.slice(0, eq).trim();
      if (keyName !== 'MONGODB_URI' && keyName !== 'ENCRYPTION_KEY') continue;
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[keyName] = value;
    }
  }

  const mongoUri = process.env.MONGODB_URI?.trim();
  const encKeyRaw = process.env.ENCRYPTION_KEY?.trim();
  if (!mongoUri) throw new Error('MONGODB_URI ausente no host');
  if (!encKeyRaw) throw new Error('ENCRYPTION_KEY ausente no host');

  const key = Buffer.from(encKeyRaw, 'base64');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY inválida (esperado 32 bytes)');

  const dryRun = process.env.DRY_RUN !== '0';
  const smokeOrgId = process.env.SMOKE_ORG_ID?.trim() || '';
  const smokeGuildId = process.env.SMOKE_GUILD_ID?.trim() || '';
  const smokeUserId = process.env.SMOKE_USER_ID?.trim() || '';

  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Conexão Mongo sem db');

  /**
   * Escolhe collection pelo nome canônico ou pelo primeiro match parcial.
   * @param {string[]} preferred Nomes preferidos em ordem
   * @param {string} needle Substring para fallback
   * @returns {Promise<string>}
   */
  async function resolveCollectionName(preferred, needle) {
    const names = (await db.listCollections().toArray()).map((c) => c.name);
    for (const name of preferred) {
      if (names.includes(name)) return name;
    }
    const fuzzy = names.find((n) => n.toLowerCase().includes(needle.toLowerCase()));
    if (fuzzy) return fuzzy;
    throw new Error(`Collection não encontrada (${needle}). Disponíveis: ${names.join(', ')}`);
  }

  const discordAppCol = await resolveCollectionName(
    ['discordapplications', 'discord_applications', 'DiscordApplication'],
    'discordapp',
  );
  const guildConnCol = await resolveCollectionName(
    ['guildconnections', 'guild_connections', 'GuildConnection'],
    'guildconnection',
  );
  const orgCol = await resolveCollectionName(['organizations', 'organization'], 'organization');

  let resolvedApp = await db.collection(discordAppCol).findOne({
    isPlatformDefault: true,
    isActive: true,
  });
  if (!resolvedApp?.botTokenEncrypted) {
    resolvedApp = await db.collection(discordAppCol).findOne({
      isActive: true,
      botTokenEncrypted: { $exists: true },
    });
  }
  if (!resolvedApp?.botTokenEncrypted) {
    const sample = await db
      .collection(discordAppCol)
      .findOne({}, { projection: { name: 1, isActive: 1, isPlatformDefault: 1, clientId: 1 } });
    const count = await db.collection(discordAppCol).countDocuments();
    throw new Error(
      `DiscordApplication com token não encontrado em ${discordAppCol} (count=${count}). sample=${JSON.stringify(sample)}`,
    );
  }

  const botToken = decryptSecret(resolvedApp.botTokenEncrypted, key);
  const botGuilds = await listBotGuilds(botToken);

  const connections = await db
    .collection(guildConnCol)
    .find({})
    .project({
      organizationId: 1,
      guildId: 1,
      guildName: 1,
      isActive: 1,
      isMonitoringEnabled: 1,
    })
    .toArray();

  const orgIds = [...new Set(connections.map((c) => String(c.organizationId)))];
  const orgs = orgIds.length
    ? await db
        .collection(orgCol)
        .find({ _id: { $in: orgIds.map((id) => new mongoose.Types.ObjectId(id)) } })
        .project({ name: 1, slug: 1 })
        .toArray()
    : [];
  const orgById = new Map(orgs.map((o) => [String(o._id), o]));

  const takenGuildIds = new Set(
    connections
      .filter((c) => c.isActive && c.isMonitoringEnabled)
      .map((c) => c.guildId),
  );
  const freeGuilds = botGuilds.filter((g) => !takenGuildIds.has(g.id));

  const summary = {
    dryRun,
    collections: { discordAppCol, guildConnCol, orgCol },
    botClientId: resolvedApp.clientId,
    botUsername: resolvedApp.botUsername ?? null,
    botGuildCount: botGuilds.length,
    botGuilds: botGuilds.map((g) => ({ guildId: g.id, guildName: g.name })),
    existingConnections: connections.map((c) => ({
      organizationId: String(c.organizationId),
      orgSlug: orgById.get(String(c.organizationId))?.slug ?? null,
      orgName: orgById.get(String(c.organizationId))?.name ?? null,
      guildId: c.guildId,
      guildName: c.guildName,
      isActive: c.isActive,
      isMonitoringEnabled: c.isMonitoringEnabled,
    })),
    freeGuildCount: freeGuilds.length,
    freeGuilds: freeGuilds.map((g) => ({ guildId: g.id, guildName: g.name })),
    provision: null,
  };

  if (!smokeOrgId) {
    summary.provision = {
      applied: false,
      reason: 'SMOKE_ORG_ID não informado — inspeção apenas',
    };
    console.log(JSON.stringify(summary, null, 2));
    await mongoose.disconnect();
    process.exit(botGuilds.length > 0 ? 0 : 3);
  }

  if (botGuilds.length === 0) {
    summary.provision = {
      applied: false,
      reason: 'Bot sem guilds — instalar via OAuth invite no guild de teste',
    };
    console.log(JSON.stringify(summary, null, 2));
    await mongoose.disconnect();
    process.exit(3);
  }

  const targetGuild = smokeGuildId
    ? botGuilds.find((g) => g.id === smokeGuildId)
    : freeGuilds[0] || botGuilds[0];

  if (!targetGuild) {
    summary.provision = {
      applied: false,
      reason: `Guild ${smokeGuildId || '(auto)'} não encontrado no bot`,
    };
    console.log(JSON.stringify(summary, null, 2));
    await mongoose.disconnect();
    process.exit(4);
  }

  if (takenGuildIds.has(targetGuild.id) && !smokeGuildId) {
    // Reusa o mesmo guild se for o único e já estiver ligado a OUTRA org — Eng precisa de um livre.
    // Se o único está taken, reporta e não rouba sem guildId explícito.
  }

  const orgObjectId = new mongoose.Types.ObjectId(smokeOrgId);
  const org = await db.collection(orgCol).findOne({ _id: orgObjectId });
  if (!org) {
    summary.provision = { applied: false, reason: `Org ${smokeOrgId} não existe` };
    console.log(JSON.stringify(summary, null, 2));
    await mongoose.disconnect();
    process.exit(5);
  }

  const selectedBy =
    smokeUserId && mongoose.Types.ObjectId.isValid(smokeUserId)
      ? new mongoose.Types.ObjectId(smokeUserId)
      : undefined;

  if (dryRun) {
    summary.provision = {
      applied: false,
      dryRun: true,
      wouldLink: {
        organizationId: smokeOrgId,
        orgSlug: org.slug,
        orgName: org.name,
        guildId: targetGuild.id,
        guildName: targetGuild.name,
      },
    };
    console.log(JSON.stringify(summary, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  }

  await db.collection(guildConnCol).updateMany(
    { organizationId: orgObjectId },
    { $set: { isMonitoringEnabled: false } },
  );

  const now = new Date();
  await db.collection(guildConnCol).updateOne(
    { organizationId: orgObjectId, guildId: targetGuild.id },
    {
      $set: {
        organizationId: orgObjectId,
        guildId: targetGuild.id,
        guildName: targetGuild.name,
        botInstalledAt: now,
        isActive: true,
        isMonitoringEnabled: true,
        selectedAt: now,
        ...(selectedBy ? { selectedBy } : {}),
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  summary.provision = {
    applied: true,
    organizationId: smokeOrgId,
    orgSlug: org.slug,
    orgName: org.name,
    guildId: targetGuild.id,
    guildName: targetGuild.name,
  };
  console.log(JSON.stringify(summary, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
