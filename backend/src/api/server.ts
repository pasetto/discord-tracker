import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import { config } from '../config/env';
import { createLogger } from '../logger';
import { corsMiddleware } from './middleware/cors';
import { authMiddleware } from './middleware/auth';
import { jwtAuth } from './middleware/jwtAuth';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { statsRouter } from './routes/stats';
import { reportsRouter } from './routes/reports';
import { metricsRouter } from './routes/metrics';

const log = createLogger('api');

/** Timestamp de início do processo para cálculo de uptime. */
export const processStartTime = Date.now();

/**
 * Cria e configura a aplicação Koa com todas as rotas.
 * @returns Instância Koa configurada
 */
export function createApp(): Koa {
  const app = new Koa();
  const publicRouter = new Router();
  const legacyProtectedRouter = new Router();
  const apiV1PublicRouter = new Router({ prefix: '/api/v1' });
  const apiV1ProtectedRouter = new Router({ prefix: '/api/v1' });

  publicRouter.use(healthRouter.routes());
  apiV1PublicRouter.use(authRouter.routes());
  apiV1PublicRouter.use(healthRouter.routes());

  legacyProtectedRouter.use(statsRouter.routes());
  legacyProtectedRouter.use(reportsRouter.routes());
  legacyProtectedRouter.use(metricsRouter.routes());
  apiV1ProtectedRouter.use('/org/:organizationId', reportsRouter.routes(), reportsRouter.allowedMethods());

  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      log.error({ err: error }, 'Erro não tratado na API');
      ctx.status = 500;
      ctx.body = { error: 'Erro interno do servidor' };
    }
  });

  app.use(corsMiddleware);
  app.use(bodyParser());
  app.use(publicRouter.routes());
  app.use(publicRouter.allowedMethods());
  app.use(apiV1PublicRouter.routes());
  app.use(apiV1PublicRouter.allowedMethods());

  app.use(authMiddleware);
  app.use(legacyProtectedRouter.routes());
  app.use(legacyProtectedRouter.allowedMethods());

  app.use(jwtAuth);
  app.use(apiV1ProtectedRouter.routes());
  app.use(apiV1ProtectedRouter.allowedMethods());

  return app;
}

/**
 * Inicia o servidor HTTP Koa.
 * @returns Promise resolvida após bind da porta
 */
export async function startServer(): Promise<void> {
  const app = createApp();

  return new Promise((resolve) => {
    app.listen(config.port, config.host, () => {
      log.info({ port: config.port, host: config.host }, 'Servidor HTTP iniciado');
      resolve();
    });
  });
}

/**
 * Retorna uptime do processo em segundos.
 * @returns Segundos desde o início
 */
export function getUptimeSeconds(): number {
  return Math.floor((Date.now() - processStartTime) / 1000);
}
