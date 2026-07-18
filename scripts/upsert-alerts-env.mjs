#!/usr/bin/env node
/**
 * Upsert seguro das variáveis SMTP_* / VAPID_* em arquivos .env.
 * Não imprime valores de secrets — só nomes e status.
 *
 * Uso (no host, com vars já no process.env):
 *   node scripts/upsert-alerts-env.mjs [.env] [backend/.env]
 */
import fs from 'node:fs';
import path from 'node:path';

/** @type {readonly string[]} */
const ALERT_KEYS = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
];

/**
 * Escapa valor para linha dotenv (aspas quando necessário).
 * @param {string} value Valor bruto
 * @returns {string} Valor seguro para .env
 */
function escapeEnvValue(value) {
  if (/[\s#"'$`\\]/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

/**
 * Lê um .env existente em mapa chave→valor (linha simples KEY=VALUE).
 * @param {string} filePath Caminho do arquivo
 * @returns {Map<string, string>} Mapa mutável das entradas
 */
function readEnvFile(filePath) {
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!fs.existsSync(filePath)) {
    return map;
  }
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trimStart().startsWith('#')) {
      map.set(`__raw_${map.size}`, line);
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) {
      map.set(`__raw_${map.size}`, line);
      continue;
    }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1);
    map.set(key, value);
  }
  return map;
}

/**
 * Grava o mapa de volta no arquivo preservando ordem aproximada.
 * @param {string} filePath Destino
 * @param {Map<string, string>} map Entradas
 * @returns {void}
 */
function writeEnvFile(filePath, map) {
  const lines = [];
  for (const [key, value] of map) {
    if (key.startsWith('__raw_')) {
      lines.push(value);
    } else {
      lines.push(`${key}=${value}`);
    }
  }
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const body = `${lines.join('\n').replace(/\n*$/, '')}\n`;
  fs.writeFileSync(filePath, body, { mode: 0o600 });
}

/**
 * Aplica as chaves de alerta presentes no process.env ao arquivo.
 * @param {string} filePath Caminho .env
 * @returns {{ updated: string[], missing: string[] }} Resumo sem valores
 */
function upsertFile(filePath) {
  const absolute = path.resolve(filePath);
  const map = readEnvFile(absolute);
  /** @type {string[]} */
  const updated = [];
  /** @type {string[]} */
  const missing = [];

  for (const key of ALERT_KEYS) {
    const raw = process.env[key];
    if (raw === undefined || raw === '') {
      missing.push(key);
      continue;
    }
    map.set(key, escapeEnvValue(raw));
    updated.push(key);
  }

  writeEnvFile(absolute, map);
  return { updated, missing };
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  targets.push('.env', 'backend/.env');
}

/** @type {string[]} */
const required = ['SMTP_HOST', 'SMTP_FROM', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'];
const missingRequired = required.filter((key) => !process.env[key]?.trim());
if (missingRequired.length > 0) {
  console.error(
    JSON.stringify({
      ok: false,
      error: 'missing_required_env',
      missingRequired,
    }),
  );
  process.exit(2);
}

const results = targets.map((target) => {
  const summary = upsertFile(target);
  return { file: path.resolve(target), ...summary };
});

const emailConfigured = Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
const vapidConfigured = Boolean(
  process.env.VAPID_PUBLIC_KEY?.trim() &&
    process.env.VAPID_PRIVATE_KEY?.trim() &&
    process.env.VAPID_SUBJECT?.trim(),
);

console.log(
  JSON.stringify(
    {
      ok: emailConfigured && vapidConfigured,
      emailConfigured,
      vapidConfigured,
      files: results.map((r) => ({
        file: r.file,
        updatedKeys: r.updated,
        skippedEmptyKeys: r.missing,
      })),
    },
    null,
    2,
  ),
);

process.exit(emailConfigured && vapidConfigured ? 0 : 2);
