import mongoose from 'mongoose';
import { connectMongo, disconnectMongo } from '../db/connection';
import { createLogger } from '../logger';
import {
  backfillSessionScopes,
  type SessionScopeBackfillResult,
} from '../services/sessionScopeBackfillService';

const log = createLogger('backfill-session-scope');

/**
 * Determina se o backfill deve gravar de fato (apply) ou apenas simular.
 * Aceita `--apply` na linha de comando ou `APPLY=true` no ambiente.
 * @returns true quando deve aplicar as alterações
 */
function shouldApply(): boolean {
  return process.argv.includes('--apply') || process.env.APPLY === 'true';
}

/**
 * Executa o backfill de escopo (org/guild) das sessões legadas como CLI.
 *
 * Por padrão roda em dry-run (não grava). Use `--apply` para persistir.
 * @returns Promise resolvida ao final da execução
 * @example
 * // Simular: npm run backfill:session-scope --workspace=backend
 * // Aplicar: npm run backfill:session-scope --workspace=backend -- --apply
 */
async function run(): Promise<void> {
  const apply = shouldApply();
  try {
    await connectMongo();
    log.info({ apply }, apply ? 'Aplicando backfill de escopo das sessões' : 'Simulando backfill (dry-run)');

    const results = await backfillSessionScopes({ apply });
    for (const result of results) {
      logResult(result, apply);
    }

    if (!apply) {
      log.info('Dry-run concluído. Reexecute com "-- --apply" para gravar as alterações.');
    }
  } catch (error) {
    log.error({ err: error }, 'Falha ao executar backfill de escopo das sessões');
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await disconnectMongo();
    }
  }
}

/**
 * Loga o resumo de uma collection e alerta sobre descartes relevantes.
 * @param result Resumo do backfill da collection
 * @param apply Indica se foi execução real ou dry-run
 * @returns {void} Não retorna valor
 */
function logResult(result: SessionScopeBackfillResult, apply: boolean): void {
  log.info(
    {
      collection: result.collection,
      totalLegacy: result.totalLegacy,
      updated: result.updated,
      skippedNoUser: result.skippedNoUser,
      skippedNoTracking: result.skippedNoTracking,
      skippedAmbiguous: result.skippedAmbiguous,
      apply,
    },
    `Backfill ${result.collection}: ${result.updated}/${result.totalLegacy} ${apply ? 'atualizadas' : 'seriam atualizadas'}`,
  );

  if (result.skippedAmbiguous > 0) {
    log.warn(
      { collection: result.collection, skippedAmbiguous: result.skippedAmbiguous },
      'Sessões com usuário rastreado em múltiplas guilds não foram atribuídas (ambíguas)',
    );
  }
}

void run();
