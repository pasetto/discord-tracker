#!/usr/bin/env npx tsx
/**
 * Smoke de prontidão de alertas (SMTP + VAPID).
 *
 * Uso:
 *   npm run smoke:alerts --workspace=backend
 *   npm run smoke:alerts --workspace=backend -- --http http://localhost:3000
 *
 * Sem `--http`: lê o env do processo (carrega `.env` se existir via dotenv).
 * Com `--http <base>`: consulta `GET /health/alerts` (ou `/api/v1/health/alerts`).
 * Exit 0 sempre que o reporter responder; exit 1 só em falha de rede/parse.
 * Exit 2 se `--strict` e algum canal estiver ausente.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getAlertsReadiness, type AlertsReadiness } from '../src/services/alertsReadinessService';

/**
 * Carrega chaves `KEY=value` de um `.env` sem sobrescrever o ambiente atual.
 * @param filePath Caminho absoluto do arquivo
 * @returns {void}
 */
function loadEnvFileIfPresent(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  for (const rawLine of readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFileIfPresent(resolve(process.cwd(), '../.env'));
loadEnvFileIfPresent(resolve(process.cwd(), '.env'));

/**
 * Argumentos CLI do smoke.
 */
interface SmokeArgs {
  httpBase?: string;
  strict: boolean;
}

/**
 * Interpreta argumentos da linha de comando.
 * @param argv Argumentos após o nome do script
 * @returns Opções de execução
 */
function parseArgs(argv: string[]): SmokeArgs {
  let httpBase: string | undefined;
  let strict = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--strict') {
      strict = true;
      continue;
    }
    if (arg === '--http') {
      httpBase = argv[i + 1]?.replace(/\/$/, '');
      i += 1;
      continue;
    }
    if (arg.startsWith('--http=')) {
      httpBase = arg.slice('--http='.length).replace(/\/$/, '');
    }
  }

  return { httpBase, strict };
}

/**
 * Busca prontidão via endpoint HTTP público.
 * @param baseUrl Base do backend (ex.: http://localhost:3000)
 * @returns Payload de alertas
 */
async function fetchAlertsReadiness(baseUrl: string): Promise<AlertsReadiness> {
  const candidates = [`${baseUrl}/health/alerts`, `${baseUrl}/api/v1/health/alerts`];
  let lastError: Error | undefined;

  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} em ${url}`);
        continue;
      }
      const body = (await response.json()) as Partial<AlertsReadiness>;
      if (typeof body.emailConfigured !== 'boolean' || typeof body.vapidConfigured !== 'boolean') {
        lastError = new Error(`Resposta inválida em ${url}`);
        continue;
      }
      return {
        emailConfigured: body.emailConfigured,
        vapidConfigured: body.vapidConfigured,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error('Falha ao consultar /health/alerts');
}

/**
 * Imprime o relatório e define o código de saída.
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const readiness = args.httpBase
    ? await fetchAlertsReadiness(args.httpBase)
    : getAlertsReadiness();

  const lines = [
    '## Smoke alertas (SMTP / VAPID)',
    '',
    `- fonte: ${args.httpBase ? `HTTP ${args.httpBase}` : 'process.env (local)'}`,
    `- emailConfigured: ${readiness.emailConfigured}`,
    `- vapidConfigured: ${readiness.vapidConfigured}`,
    '',
    readiness.emailConfigured
      ? '- email: OK (SMTP_HOST + SMTP_FROM presentes)'
      : '- email: AUSENTE — digest semanal desabilitado até configurar SMTP_*',
    readiness.vapidConfigured
      ? '- push: OK (VAPID_* presentes)'
      : '- push: AUSENTE — web push desabilitado até configurar VAPID_*',
  ];

  console.log(lines.join('\n'));

  if (args.strict && (!readiness.emailConfigured || !readiness.vapidConfigured)) {
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  console.error('Smoke falhou:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
