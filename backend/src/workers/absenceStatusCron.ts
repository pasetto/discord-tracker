import { createLogger } from '../logger';
import { transitionPlannedAbsenceStatuses } from '../services/plannedAbsenceService';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const log = createLogger('absence-status-cron');

/**
 * Executa um ciclo de atualização de status das ausências.
 * @returns Resultado agregado das transições aplicadas
 */
export async function runAbsenceStatusCronTick(): Promise<{ scheduledToActive: number; activeToCompleted: number }> {
  const result = await transitionPlannedAbsenceStatuses(new Date());
  log.info(result, 'Ciclo de atualização de status de ausências concluído');
  return result;
}

/**
 * Inicia cron diário de atualização de status das ausências planejadas.
 * @returns Handler de cleanup para parar o cron
 */
export function startAbsenceStatusCron(): () => void {
  runAbsenceStatusCronTick().catch((error) => {
    log.error({ err: error }, 'Falha no ciclo inicial de atualização de ausências');
  });

  const interval = setInterval(() => {
    runAbsenceStatusCronTick().catch((error) => {
      log.error({ err: error }, 'Falha no ciclo diário de atualização de ausências');
    });
  }, ONE_DAY_MS);

  return () => clearInterval(interval);
}
