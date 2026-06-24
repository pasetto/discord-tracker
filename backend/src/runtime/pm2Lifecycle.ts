import mongoose from 'mongoose';
import { createLogger } from '../logger';
import {
  getApplicationReadinessState,
  getUnhealthyReason,
  markApplicationReady,
  markApplicationUnhealthy,
  markApplicationShuttingDown,
  recoverApplicationReadiness,
} from './applicationState';

const log = createLogger('pm2');

/** Mensagem IPC enviada ao PM2 quando o processo está pronto (`wait_ready: true`). */
export const PM2_READY_MESSAGE = 'ready';

/** Tópico IPC customizado para eventos de saúde do processo. */
export const PM2_HEALTH_TOPIC = 'syntra:health';

/**
 * Verifica se o processo foi iniciado pelo PM2 com canal IPC disponível.
 * @returns true quando `process.send` existe (fork/cluster PM2)
 */
export function isPm2ManagedProcess(): boolean {
  return typeof process.send === 'function';
}

/**
 * Notifica o PM2 que o servidor HTTP está pronto para receber tráfego.
 * Requer `wait_ready: true` no `ecosystem.config.js`.
 */
export function signalPm2Ready(): void {
  markApplicationReady();

  if (!isPm2ManagedProcess()) {
    log.debug('PM2 ready ignorado — processo não gerenciado pelo PM2');
    return;
  }

  process.send!(PM2_READY_MESSAGE);
  log.info(
    {
      instanceId: process.env.NODE_APP_INSTANCE ?? 'fork',
      pmId: process.env.pm_id,
    },
    'Sinal ready enviado ao PM2',
  );
}

/**
 * Notifica o PM2 e probes HTTP que o processo está unhealthy.
 * @param reason Motivo operacional da degradação
 * @param options.exitOnUnhealthy Quando true, encerra o processo para o PM2 reiniciar
 */
export function signalPm2Unhealthy(reason: string, options?: { exitOnUnhealthy?: boolean }): void {
  markApplicationUnhealthy(reason);

  if (isPm2ManagedProcess()) {
    process.send!({
      type: 'process:msg',
      topic: PM2_HEALTH_TOPIC,
      data: {
        status: 'unhealthy',
        reason,
        readiness: getApplicationReadinessState(),
        timestamp: new Date().toISOString(),
      },
    });
  }

  log.error({ reason }, 'Processo marcado como unhealthy');

  if (options?.exitOnUnhealthy) {
    process.exit(1);
  }
}

/**
 * Registra handler de shutdown gracioso enviado pelo PM2 em reload cluster (`shutdown_with_message`).
 * @param onShutdown Callback assíncrono de encerramento (fecha HTTP, workers, etc.)
 */
export function registerPm2GracefulShutdown(onShutdown: (signal: string) => Promise<void>): void {
  process.on('message', (message: unknown) => {
    if (message === 'shutdown') {
      markApplicationShuttingDown();
      log.info('Shutdown gracioso solicitado pelo PM2');
      void onShutdown('pm2-shutdown');
    }
  });
}

/**
 * Observa eventos do Mongoose para marcar/recuperar saúde do processo.
 */
export function watchMongoConnectionHealth(): void {
  mongoose.connection.on('disconnected', () => {
    signalPm2Unhealthy('MongoDB desconectado');
  });

  mongoose.connection.on('reconnected', () => {
    if (getApplicationReadinessState() === 'unhealthy' && getUnhealthyReason()?.includes('MongoDB')) {
      recoverApplicationReadiness();
      log.info('Readiness recuperada após reconexão MongoDB');
    }
  });
}
