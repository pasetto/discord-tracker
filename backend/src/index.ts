import { connectMongo, disconnectMongo } from './db/connection';
import { BotTokenInvalidError, connectDiscord, disconnectDiscord, getDiscordPing } from './bot/client';
import { registerReadyHandler } from './bot/events/ready';
import { startServer } from './api/server';
import { createLogger } from './logger';
import { setDiscordPing } from './metrics/prometheus';
import { PlatformNotConfiguredError } from './services/botManager';
import { startAbsenceStatusCron } from './workers/absenceStatusCron';
import { startInactivityCron } from './workers/inactivityCron';
import { startIntradayInactivityCron } from './workers/intradayInactivityCron';
import { startWebhookWorker } from './workers/webhookWorker';

const log = createLogger('main');
let stopAbsenceStatusCron: (() => void) | undefined;
let stopInactivityCron: (() => void) | undefined;
let stopIntradayInactivityCron: (() => void) | undefined;
let stopWebhookWorker: (() => void) | undefined;

/**
 * Inicia todos os subsistemas da aplicação.
 */
async function bootstrap(): Promise<void> {
  log.info('Iniciando Syntra...');

  await connectMongo();
  registerReadyHandler();

  try {
    await connectDiscord();
    log.info('Bot Discord conectado a partir do banco de dados');
  } catch (error) {
    if (error instanceof PlatformNotConfiguredError) {
      log.warn(
        'Bot Discord não configurado. Cadastre o aplicativo em /admin/discord ou execute npm run seed:discord-app',
      );
    } else if (error instanceof BotTokenInvalidError) {
      log.error(
        { err: error },
        'Token do bot inválido no banco. Atualize em /admin/discord e remova DISCORD_TOKEN do .env',
      );
    } else {
      log.error({ err: error }, 'Falha ao conectar bot Discord; API continuará sem bot');
    }
  }

  await startServer();
  stopAbsenceStatusCron = startAbsenceStatusCron();
  stopInactivityCron = startInactivityCron();
  stopIntradayInactivityCron = startIntradayInactivityCron();
  stopWebhookWorker = startWebhookWorker();

  // Atualiza ping periodicamente
  setInterval(() => {
    setDiscordPing(getDiscordPing());
  }, 30_000);

  log.info('Syntra em execução');
}

/**
 * Encerra a aplicação graciosamente.
 */
async function shutdown(signal: string): Promise<void> {
  log.info({ signal }, 'Encerrando aplicação...');

  try {
    stopAbsenceStatusCron?.();
    stopInactivityCron?.();
    stopIntradayInactivityCron?.();
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
