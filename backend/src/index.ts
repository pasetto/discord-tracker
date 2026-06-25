import './instrumentation/sentry';
import type http from 'http';
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
import { markApplicationStarting, markApplicationShuttingDown } from './runtime/applicationState';
import { shouldRunBackgroundJobs, getClusterInstanceId } from './runtime/clusterRole';
import {
  registerPm2GracefulShutdown,
  signalPm2Ready,
  watchMongoConnectionHealth,
} from './runtime/pm2Lifecycle';
import { captureApiException, flushSentry } from './instrumentation/sentry';

const log = createLogger('main');

let httpServer: http.Server | undefined;
let stopAbsenceStatusCron: (() => void) | undefined;
let stopInactivityCron: (() => void) | undefined;
let stopIntradayInactivityCron: (() => void) | undefined;
let stopWebhookWorker: (() => void) | undefined;
let stopPingInterval: (() => void) | undefined;
let shutdownInProgress = false;

/**
 * Inicia todos os subsistemas da aplicação.
 */
async function bootstrap(): Promise<void> {
  markApplicationStarting();
  const runsBackgroundJobs = shouldRunBackgroundJobs();

  log.info(
    {
      clusterInstanceId: getClusterInstanceId(),
      runsBackgroundJobs,
      pm2Managed: process.env.NODE_APP_INSTANCE !== undefined,
    },
    'Iniciando Syntra...',
  );

  await connectMongo();
  watchMongoConnectionHealth();

  if (runsBackgroundJobs) {
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
  } else {
    log.info('Instância API-only — bot Discord e crons não serão iniciados neste worker');
  }

  httpServer = await startServer();

  if (runsBackgroundJobs) {
    stopAbsenceStatusCron = startAbsenceStatusCron();
    stopInactivityCron = startInactivityCron();
    stopIntradayInactivityCron = startIntradayInactivityCron();
    stopWebhookWorker = startWebhookWorker();

    const pingTimer = setInterval(() => {
      setDiscordPing(getDiscordPing());
    }, 30_000);
    stopPingInterval = () => clearInterval(pingTimer);
  }

  signalPm2Ready();
  log.info('Syntra em execução');
}

/**
 * Fecha o servidor HTTP e aguarda conexões encerrarem.
 */
async function closeHttpServer(): Promise<void> {
  if (!httpServer) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    httpServer!.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

/**
 * Encerra a aplicação graciosamente.
 * @param signal Origem do shutdown (SIGTERM, PM2, etc.)
 */
async function shutdown(signal: string): Promise<void> {
  if (shutdownInProgress) {
    return;
  }
  shutdownInProgress = true;
  markApplicationShuttingDown();

  log.info({ signal }, 'Encerrando aplicação...');

  try {
    stopPingInterval?.();
    stopAbsenceStatusCron?.();
    stopInactivityCron?.();
    stopIntradayInactivityCron?.();
    stopWebhookWorker?.();
    await closeHttpServer();
    await disconnectDiscord();
    await disconnectMongo();
    await flushSentry();
    process.exit(0);
  } catch (error) {
    log.error({ err: error }, 'Erro durante shutdown');
    captureApiException(error);
    await flushSentry();
    process.exit(1);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

registerPm2GracefulShutdown(shutdown);

process.on('unhandledRejection', (reason) => {
  log.error({ err: reason }, 'Unhandled rejection');
  captureApiException(reason);
});

bootstrap().catch(async (error) => {
  log.error({ err: error }, 'Falha fatal na inicialização');
  captureApiException(error);
  await flushSentry();
  process.exit(1);
});
