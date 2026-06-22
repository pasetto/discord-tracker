import Koa from 'koa';

import Router from '@koa/router';

import bodyParser from 'koa-bodyparser';

import serve from 'koa-static';

import path from 'path';

import { config } from '../config/env';

import { createLogger } from '../logger';

import { authMiddleware } from './middleware/auth';

import { healthRouter } from './routes/health';

import { loginRouter } from './routes/login';

import { statsRouter } from './routes/stats';

import { reportsRouter } from './routes/reports';

import { metricsRouter } from './routes/metrics';

import { dashboardRouter } from './routes/dashboard';



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

  const protectedRouter = new Router();



  publicRouter.use(healthRouter.routes());

  publicRouter.use(loginRouter.routes());



  protectedRouter.use(statsRouter.routes());

  protectedRouter.use(reportsRouter.routes());

  protectedRouter.use(metricsRouter.routes());

  protectedRouter.use(dashboardRouter.routes());



  app.use(async (ctx, next) => {

    try {

      await next();

    } catch (error) {

      log.error({ err: error }, 'Erro não tratado na API');

      ctx.status = 500;

      ctx.body = { error: 'Erro interno do servidor' };

    }

  });



  app.use(bodyParser());

  app.use(publicRouter.routes());

  app.use(publicRouter.allowedMethods());



  app.use(authMiddleware);

  app.use(protectedRouter.routes());

  app.use(protectedRouter.allowedMethods());



  const publicPath = path.join(__dirname, '..', 'dashboard', 'public');

  app.use(serve(publicPath));



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


