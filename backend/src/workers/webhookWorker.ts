import { createLogger } from '../logger';
import { processPendingWebhookDeliveries } from '../services/webhookService';

const DEFAULT_WEBHOOK_WORKER_INTERVAL_MS = 30_000;
const DEFAULT_WEBHOOK_WORKER_BATCH_SIZE = 20;
const log = createLogger('webhook-worker');

/**
 * Executa um ciclo de processamento de entregas webhook pendentes.
 * @param now Instante de referência opcional para due/retry.
 * @returns Quantidade de entregas efetivamente processadas no ciclo.
 */
export async function runWebhookWorkerTick(now: Date = new Date()): Promise<number> {
  const processed = await processPendingWebhookDeliveries(DEFAULT_WEBHOOK_WORKER_BATCH_SIZE, now);
  if (processed > 0) {
    log.info({ processed }, 'Ciclo do worker de webhooks concluído');
  }

  return processed;
}

/**
 * Inicia worker de webhooks outbound com polling periódico.
 * @param intervalMs Intervalo de polling em milissegundos.
 * @returns Função de cleanup para parar o worker no shutdown.
 */
export function startWebhookWorker(intervalMs: number = DEFAULT_WEBHOOK_WORKER_INTERVAL_MS): () => void {
  runWebhookWorkerTick().catch((error) => {
    log.error({ err: error }, 'Falha no ciclo inicial do worker de webhooks');
  });

  const interval = setInterval(() => {
    runWebhookWorkerTick().catch((error) => {
      log.error({ err: error }, 'Falha no ciclo do worker de webhooks');
    });
  }, Math.max(5_000, intervalMs));

  return () => clearInterval(interval);
}
