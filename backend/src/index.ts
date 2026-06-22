import { connectMongo, disconnectMongo } from './db/connection';
import { connectDiscord, disconnectDiscord, getDiscordPing } from './bot/client';
import { registerReadyHandler } from './bot/events/ready';
import { startServer } from './api/server';
import { createLogger } from './logger';
import { setDiscordPing } from './metrics/prometheus';
import { config } from './config/env';
import { startAbsenceStatusCron } from './workers/absenceStatusCron';
import { startInactivityCron } from './workers/inactivityCron';
import { startWebhookWorker } from './workers/webhookWorker';

const log = createLogger('main');
let stopAbsenceStatusCron: (() => void) | undefined;
let stopInactivityCron: (() => void) | undefined;
let stopWebhookWorker: (() => void) | undefined;

/**
 * Inicia todos os subsistemas da aplicação.
 */
async function bootstrap(): Promise<void> {
  log.info('Iniciando Discord Tracker...');

  await connectMongo();
  if (config.discordToken) {
    registerReadyHandler();
    await connectDiscord();
  } else {
    log.warn('DISCORD_TOKEN ausente em desenvolvimento: inicializando API sem bot Discord');
  }
  await startServer();
  stopAbsenceStatusCron = startAbsenceStatusCron();
  stopInactivityCron = startInactivityCron();
  stopWebhookWorker = startWebhookWorker();

  // Atualiza ping periodicamente
  setInterval(() => {
    setDiscordPing(getDiscordPing());
  }, 30_000);

  log.info('Discord Tracker em execução');
}

/**
 * Encerra a aplicação graciosamente.
 */
async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, 'Encerrando aplicação...');

  try {
    stopAbsenceStatusCron?.();
    stopInactivityCron?.();
    stopWebhookWorker?.();
    await disconnectDiscord();
    await disconnectMongo();
    process.exit(0);
  } catch (error) {
    log.error({ err: error }, 'Erro durante shutdown');
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  log.error({ err: reason }, 'Unhandled rejection');
});

bootstrap().catch((error) => {
  log.error({ err: error }, 'Falha fatal na inicialização');
  process.exit(1);
});
