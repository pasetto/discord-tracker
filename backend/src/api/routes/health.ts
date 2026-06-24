import Router from '@koa/router';
import { getDiscordPing } from '../../bot/client';
import { evaluateProcessHealth } from '../health/processHealth';
import { getUptimeSeconds } from '../server';

/** Rotas de healthcheck. */
export const healthRouter = new Router();

/**
 * GET /health/live - Liveness probe (processo vivo, não em shutdown).
 */
healthRouter.get('/health/live', (ctx) => {
  const health = evaluateProcessHealth();

  ctx.status = health.live ? 200 : 503;
  ctx.body = {
    status: health.live ? 'alive' : 'shutting_down',
    readiness: health.readiness,
    uptime: getUptimeSeconds(),
    timestamp: new Date().toISOString(),
  };
});

/**
 * GET /health/ready - Readiness probe (pronto para receber tráfego HTTP).
 * Usado pelo PM2 (`wait_ready`), Docker HEALTHCHECK e load balancers.
 */
healthRouter.get('/health/ready', (ctx) => {
  const health = evaluateProcessHealth();

  ctx.status = health.ready ? 200 : 503;
  ctx.body = {
    status: health.ready ? 'ready' : 'not_ready',
    readiness: health.readiness,
    unhealthyReason: health.unhealthyReason,
    mongodbConnected: health.mongodbConnected,
    discordRequired: health.discordRequired,
    discordConnected: health.discordConnected,
    clusterInstanceId: health.clusterInstanceId,
    runsBackgroundJobs: health.runsBackgroundJobs,
    uptime: getUptimeSeconds(),
    timestamp: new Date().toISOString(),
  };
});

/**
 * GET /health - Healthcheck legado (compatível com monitoramento existente).
 * Em cluster, instâncias API-only não exigem Discord conectado neste processo.
 */
healthRouter.get('/health', (ctx) => {
  const health = evaluateProcessHealth();

  ctx.status = health.ready ? 200 : 503;
  const discordOk = !health.discordRequired || health.discordConnected === true;
  ctx.body = {
    status: health.ready ? (discordOk ? 'ok' : 'degraded') : 'degraded',
    readiness: health.readiness,
    unhealthyReason: health.unhealthyReason,
    discordConnected: health.discordConnected ?? false,
    discordRequired: health.discordRequired,
    mongodbConnected: health.mongodbConnected,
    clusterInstanceId: health.clusterInstanceId,
    runsBackgroundJobs: health.runsBackgroundJobs,
    uptime: getUptimeSeconds(),
    timestamp: new Date().toISOString(),
  };
});

/**
 * GET /health/details - Healthcheck detalhado com métricas de sistema.
 */
healthRouter.get('/health/details', (ctx) => {
  const mem = process.memoryUsage();
  const health = evaluateProcessHealth();

  ctx.status = health.ready ? 200 : 503;
  ctx.body = {
    readiness: health.readiness,
    unhealthyReason: health.unhealthyReason,
    discord: {
      required: health.discordRequired,
      connected: health.discordConnected,
      ping: health.discordRequired ? getDiscordPing() : null,
    },
    mongodb: {
      connected: health.mongodbConnected,
    },
    cluster: {
      instanceId: health.clusterInstanceId,
      runsBackgroundJobs: health.runsBackgroundJobs,
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
