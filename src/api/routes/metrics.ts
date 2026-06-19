import Router from '@koa/router';
import { register, updateProcessMetrics, setDiscordPing } from '../../metrics/prometheus';
import { getDiscordPing } from '../../bot/client';

/** Rotas de métricas Prometheus. */
export const metricsRouter = new Router();

/**
 * GET /metrics - Endpoint Prometheus.
 */
metricsRouter.get('/metrics', async (ctx) => {
  setDiscordPing(getDiscordPing());
  updateProcessMetrics();

  ctx.set('Content-Type', register.contentType);
  ctx.body = await register.metrics();
});
