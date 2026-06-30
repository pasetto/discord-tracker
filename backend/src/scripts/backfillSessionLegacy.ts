import mongoose from 'mongoose';
import { connectMongo, disconnectMongo } from '../db/connection';
import { createLogger } from '../logger';
import {
  runSessionLegacyCleanup,
  type SessionLegacyCleanupSummary,
} from '../services/sessionLegacyCleanupService';
import { getCurrentYearMonth, parseDateString } from '../utils/timezone';

const log = createLogger('backfill-session-legacy');

type CleanupStep = 'open-sessions' | 'daily-reports';

/**
 * Determina se o saneamento deve gravar de fato (apply) ou apenas simular.
 * @returns true quando deve aplicar as alterações
 */
function shouldApply(): boolean {
  return process.argv.includes('--apply') || process.env.APPLY === 'true';
}

/**
 * Lê argumento `--chave=valor` da linha de comando.
 * @param name Nome do argumento sem `--`
 * @returns Valor informado ou undefined
 */
function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

/**
 * Resolve o intervalo de dias para regenerar relatórios diários.
 * @returns Par from/to como Date
 */
function resolveDateRange(): { from: Date; to: Date } {
  const fromArg = readArg('from');
  const toArg = readArg('to');

  if (fromArg && toArg) {
    return { from: parseDateString(fromArg), to: parseDateString(toArg) };
  }

  const { year, month } = getCurrentYearMonth();
  const from = parseDateString(`${year}-${String(month).padStart(2, '0')}-01`);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = parseDateString(`${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  return { from, to };
}

/**
 * Resolve quais passos executar (`open-sessions`, `daily-reports` ou ambos).
 * @returns Lista de passos
 */
function resolveSteps(): CleanupStep[] {
  const only = readArg('only');
  if (only === 'open-sessions') {
    return ['open-sessions'];
  }
  if (only === 'daily-reports') {
    return ['daily-reports'];
  }
  return ['open-sessions', 'daily-reports'];
}

/**
 * Executa o saneamento de sessões legadas como CLI.
 *
 * Por padrão roda em dry-run. Use `--apply` para persistir.
 * @returns Promise resolvida ao final da execução
 * @example
 * // Simular mês atual: npm run backfill:session-legacy --workspace=backend
 * // Aplicar junho/2026: npm run backfill:session-legacy --workspace=backend -- --apply --from=2026-06-01 --to=2026-06-30
 * // Só fechar duplicadas abertas: npm run backfill:session-legacy --workspace=backend -- --apply --only=open-sessions
 */
async function run(): Promise<void> {
  const apply = shouldApply();
  const { from, to } = resolveDateRange();
  const steps = resolveSteps();
  const organizationId = readArg('org');
  const guildId = readArg('guild');

  try {
    await connectMongo();
    log.info(
      { apply, from: from.toISOString(), to: to.toISOString(), steps, organizationId, guildId },
      apply ? 'Aplicando saneamento legado de sessões' : 'Simulando saneamento legado (dry-run)',
    );

    const summary = await runSessionLegacyCleanup({
      apply,
      from,
      to,
      steps,
      organizationId,
      guildId,
    });

    logSummary(summary, apply);

    if (!apply) {
      log.info('Dry-run concluído. Reexecute com "-- --apply" para gravar as alterações.');
    }
  } catch (error) {
    log.error({ err: error }, 'Falha ao executar saneamento legado de sessões');
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await disconnectMongo();
    }
  }
}

/**
 * Loga o resumo do saneamento legado.
 * @param summary Resultado agregado
 * @param apply Indica se foi execução real
 * @returns void
 */
function logSummary(summary: SessionLegacyCleanupSummary, apply: boolean): void {
  for (const result of [summary.duplicateOpenVoice, summary.duplicateOpenPresence]) {
    log.info(
      {
        collection: result.collection,
        groupsWithDuplicates: result.groupsWithDuplicates,
        sessionsClosed: result.sessionsClosed,
        sessionsKeptOpen: result.sessionsKeptOpen,
        apply,
      },
      `Sessões abertas duplicadas (${result.collection}): ${result.sessionsClosed} ${apply ? 'fechadas' : 'seriam fechadas'} em ${result.groupsWithDuplicates} grupos`,
    );
  }

  log.info(
    { daysProcessed: summary.dailyReports.daysProcessed, apply },
    `Relatórios diários: ${summary.dailyReports.daysProcessed} dia(s) ${apply ? 'regenerados' : 'seriam regenerados'}`,
  );
}

void run();
