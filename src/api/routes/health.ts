import Router from '@koa/router';
import { checkDiscordHealth, getDiscordPing } from '../../bot/client';
import { checkMongoHealth } from '../../db/connection';
import { getUptimeSeconds } from '../server';

/** Rotas de healthcheck. */
export const healthRouter = new Router();

/**
 * GET /health - Healthcheck básico.
 * Retorna 500 se Discord ou MongoDB indisponíveis.
 */
healthRouter.get('/health', (ctx) => {
  const discordConnected = checkDiscordHealth();
  const mongodbConnected = checkMongoHealth();
  const healthy = discordConnected && mongodbConnected;

  ctx.status = healthy ? 200 : 500;
  ctx.body = {
    status: healthy ? 'ok' : 'degraded',
    discordConnected,
    mongodbConnected,
    uptime: getUptimeSeconds(),
    timestamp: new Date().toISOString(),
  };
});

/**
 * GET /health/details - Healthcheck detalhado com métricas de sistema.
 */
healthRouter.get('/health/details', (ctx) => {
  const mem = process.memoryUsage();
  const discordConnected = checkDiscordHealth();
  const mongodbConnected = checkMongoHealth();
  const healthy = discordConnected && mongodbConnected;

  ctx.status = healthy ? 200 : 500;
  ctx.body = {
    discord: {
      connected: discordConnected,
      ping: getDiscordPing(),
    },
    mongodb: {
      connected: mongodbConnected,
    },
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
    },
    uptime: getUptimeSeconds(),
    timestamp: new Date().toISOString(),
  };
});
