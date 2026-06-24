/**
 * Identificador da instância no cluster PM2 (`NODE_APP_INSTANCE`) ou `0` fora do cluster.
 * @returns Índice numérico da instância
 */
export function getClusterInstanceId(): number {
  const raw = process.env.NODE_APP_INSTANCE?.trim();
  if (!raw) {
    return 0;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Indica se o processo atual está sob gerenciamento do PM2 em modo cluster.
 * @returns true quando `NODE_APP_INSTANCE` está definido
 */
export function isPm2ClusterWorker(): boolean {
  return process.env.NODE_APP_INSTANCE !== undefined;
}

/**
 * Decide se este processo deve executar bot Discord, crons e workers em background.
 *
 * Em cluster PM2, apenas a instância `0` executa jobs por padrão para evitar
 * duplicação de eventos Discord e tarefas agendadas. Override via `SYNTA_ENABLE_BACKGROUND_JOBS`.
 *
 * @returns true quando bot/crons devem rodar neste processo
 * @example
 * // Forçar worker dedicado (fork separado)
 * SYNTA_ENABLE_BACKGROUND_JOBS=true node dist/index.js
 */
export function shouldRunBackgroundJobs(): boolean {
  const explicit = process.env.SYNTA_ENABLE_BACKGROUND_JOBS?.trim().toLowerCase();
  if (explicit === 'true') {
    return true;
  }
  if (explicit === 'false') {
    return false;
  }

  if (!isPm2ClusterWorker()) {
    return true;
  }

  return getClusterInstanceId() === 0;
}
