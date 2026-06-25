import Koa from 'koa';
import Router from '@koa/router';
import bodyParser from 'koa-bodyparser';
import http from 'http';
import { config } from '../config/env';
import { createLogger } from '../logger';
import { corsMiddleware } from './middleware/cors';
import { jwtAuth } from './middleware/jwtAuth';
import { tenantMiddleware } from './middleware/tenant';
import { stripeRawBodyMiddleware } from './middleware/stripeRawBody';
import { internalAuthMiddleware } from './middleware/internalAuth';
import { createRateLimitMiddleware } from './middleware/rateLimit';
import { authRouter, authSessionRouter } from './routes/auth';
import { publicRouter as publicRoutesRouter } from './routes/public';
import { healthRouter } from './routes/health';
import { reportsRouter } from './routes/reports';
import { metricsRouter } from './routes/metrics';
import { legacyDeprecatedRouter } from './routes/legacyDeprecated';
import { channelsRouter } from './routes/channels';
import { categoriesRouter } from './routes/categories';
import { workCalendarRouter } from './routes/workCalendar';
import { absencesRouter } from './routes/absences';
import { absenceRequestsRouter } from './routes/absenceRequests';
import { inactivityRouter } from './routes/inactivity';
import { goalsRouter } from './routes/goals';
import { gamificationRouter } from './routes/gamification';
import { exportRouter } from './routes/export';
import { onboardingRouter } from './routes/onboarding';
import { billingRouter } from './routes/billing';
import { pushRouter } from './routes/push';
import { webhooksRouter } from './routes/webhooks';
import { meRouter } from './routes/me';
import { adminDiscordBootstrapRouter, adminDiscordRouter } from './routes/adminDiscord';
import { adminPlansRouter } from './routes/adminPlans';
import { adminUsersRouter } from './routes/adminUsers';
import { adminOrganizationsRouter } from './routes/adminOrganizations';
import { discordSettingsRouter } from './routes/discordSettings';
import { dashboardRouter } from './routes/dashboard';
import { trackedUsersRouter } from './routes/trackedUsers';
import { textCollaborationReportsRouter } from './routes/textCollaborationReports';
import { superAdminMiddleware } from './middleware/superAdmin';
import { stripeWebhookRouter } from './routes/webhooks/stripe';
import { getOpenApiSpec } from './swagger';
import { organizationTeamRouter, assertTeamManagerAccess } from './routes/organizationTeam';
import { organizationSettingsRouter } from './routes/organizationSettings';
import { attachLiveActivityWebSocket } from './websocket/liveActivitySocket';
import {
  captureApiException,
  sentryRequestMiddleware,
  setupSentryKoaErrorHandler,
} from '../instrumentation/sentry';

const swaggerUi = require('koa-swagger-ui').ui as (
  document: object,
  options?: { pathRoot?: string; skipPaths?: string[] },
) => Koa.Middleware;

const log = createLogger('api');
const jsonBodyParser = bodyParser({ jsonLimit: '1mb' });
const authRateLimit = createRateLimitMiddleware({
  keyPrefix: 'auth',
  windowMs: 15 * 60 * 1000,
  max: 60,
});

/** Timestamp de início do processo para cálculo de uptime. */
export const processStartTime = Date.now();

/**
 * Cria e configura a aplicação Koa com todas as rotas.
 * @returns Instância Koa configurada
 */
export function createApp(): Koa {
  const app = new Koa();
  app.proxy = config.nodeEnv === 'production';
  setupSentryKoaErrorHandler(app);
  const publicRouter = new Router();
  const internalRouter = new Router();
  const apiV1PublicRouter = new Router({ prefix: '/api/v1' });
  const apiV1ProtectedRouter = new Router({ prefix: '/api/v1' });
  const openApiSpec = getOpenApiSpec();

  publicRouter.use(healthRouter.routes());
  internalRouter.use(internalAuthMiddleware);
  internalRouter.use(metricsRouter.routes());

  apiV1PublicRouter.use(authRateLimit);
  apiV1PublicRouter.use(authRouter.routes());
  apiV1PublicRouter.use(publicRoutesRouter.routes());
  apiV1PublicRouter.use(adminDiscordBootstrapRouter.routes());
  apiV1PublicRouter.use(healthRouter.routes());
  apiV1PublicRouter.use(stripeWebhookRouter.routes());
  apiV1PublicRouter.get('/docs/openapi.json', (ctx) => {
    ctx.set('Content-Type', 'application/json');
    ctx.body = openApiSpec;
  });
  app.use(swaggerUi(openApiSpec, { pathRoot: '/api/v1/docs', skipPaths: ['/api/v1/docs/openapi.json'] }));

  apiV1ProtectedRouter.use(jwtAuth);
  apiV1ProtectedRouter.use(authSessionRouter.routes(), authSessionRouter.allowedMethods());
  apiV1ProtectedRouter.use(
    '/org/:organizationId',
    tenantMiddleware,
    reportsRouter.routes(),
    reportsRouter.allowedMethods(),
  );
  apiV1ProtectedRouter.use('/org/:orgId', tenantMiddleware, channelsRouter.routes(), channelsRouter.allowedMethods());
  apiV1ProtectedRouter.use('/org/:orgId', tenantMiddleware, categoriesRouter.routes(), categoriesRouter.allowedMethods());
  apiV1ProtectedRouter.use(
    '/org/:orgId',
    tenantMiddleware,
    workCalendarRouter.routes(),
    workCalendarRouter.allowedMethods(),
  );
  apiV1ProtectedRouter.use('/org/:orgId', tenantMiddleware, absencesRouter.routes(), absencesRouter.allowedMethods());
  apiV1ProtectedRouter.use(
    '/org/:orgId',
    tenantMiddleware,
    absenceRequestsRouter.routes(),
    absenceRequestsRouter.allowedMethods(),
  );
  apiV1ProtectedRouter.use('/org/:orgId', tenantMiddleware, inactivityRouter.routes(), inactivityRouter.allowedMethods());
  apiV1ProtectedRouter.use('/org/:orgId', tenantMiddleware, goalsRouter.routes(), goalsRouter.allowedMethods());
  apiV1ProtectedRouter.use('/org/:orgId', tenantMiddleware, gamificationRouter.routes(), gamificationRouter.allowedMethods());
  apiV1ProtectedRouter.use('/org/:orgId', tenantMiddleware, exportRouter.routes(), exportRouter.allowedMethods());
  apiV1ProtectedRouter.use('/org/:orgId', tenantMiddleware, onboardingRouter.routes(), onboardingRouter.allowedMethods());
  apiV1ProtectedRouter.use('/org/:orgId', tenantMiddleware, billingRouter.routes(), billingRouter.allowedMethods());
  apiV1ProtectedRouter.use('/org/:orgId', tenantMiddleware, pushRouter.routes(), pushRouter.allowedMethods());
  apiV1ProtectedRouter.use('/org/:orgId', tenantMiddleware, webhooksRouter.routes(), webhooksRouter.allowedMethods());
  apiV1ProtectedRouter.use('/org/:orgId', tenantMiddleware, trackedUsersRouter.routes(), trackedUsersRouter.allowedMethods());
  apiV1ProtectedRouter.use(
    '/org/:orgId',
    tenantMiddleware,
    textCollaborationReportsRouter.routes(),
    textCollaborationReportsRouter.allowedMethods(),
  );
  apiV1ProtectedRouter.use('/org/:orgId', tenantMiddleware, dashboardRouter.routes(), dashboardRouter.allowedMethods());
  apiV1ProtectedRouter.use('/org/:orgId', tenantMiddleware, discordSettingsRouter.routes(), discordSettingsRouter.allowedMethods());
  apiV1ProtectedRouter.use(
    '/org/:orgId',
    tenantMiddleware,
    organizationSettingsRouter.routes(),
    organizationSettingsRouter.allowedMethods(),
  );
  apiV1ProtectedRouter.use(
    '/org/:orgId',
    tenantMiddleware,
    assertTeamManagerAccess,
    organizationTeamRouter.routes(),
    organizationTeamRouter.allowedMethods(),
  );
  apiV1ProtectedRouter.use(meRouter.routes(), meRouter.allowedMethods());
  apiV1ProtectedRouter.use(
    superAdminMiddleware,
    adminDiscordRouter.routes(),
    adminDiscordRouter.allowedMethods(),
    adminPlansRouter.routes(),
    adminPlansRouter.allowedMethods(),
    adminUsersRouter.routes(),
    adminUsersRouter.allowedMethods(),
    adminOrganizationsRouter.routes(),
    adminOrganizationsRouter.allowedMethods(),
  );

  app.use(sentryRequestMiddleware);

  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      log.error({ err: error }, 'Erro não tratado na API');
      captureApiException(error, ctx);
      ctx.status = 500;
      ctx.body = { error: 'Erro interno do servidor' };
    }
  });

  app.use(corsMiddleware);
  app.use(stripeRawBodyMiddleware);
  app.use(async (ctx, next) => {
    if (ctx.state.stripeRawBody) {
      await next();
      return;
    }
    await jsonBodyParser(ctx, next);
  });
  app.use(publicRouter.routes());
  app.use(publicRouter.allowedMethods());
  app.use(internalRouter.routes());
  app.use(internalRouter.allowedMethods());
  app.use(apiV1PublicRouter.routes());
  app.use(apiV1PublicRouter.allowedMethods());
  app.use(legacyDeprecatedRouter.routes());
  app.use(legacyDeprecatedRouter.allowedMethods());
  app.use(apiV1ProtectedRouter.routes());
  app.use(apiV1ProtectedRouter.allowedMethods());

  return app;
}

/**
 * Inicia o servidor HTTP Koa com WebSocket de atividade ao vivo.
 * @returns Servidor HTTP para shutdown gracioso
 */
export async function startServer(): Promise<http.Server> {
  const app = createApp();
  const server = http.createServer(app.callback());
  attachLiveActivityWebSocket(server);

  return new Promise((resolve) => {
    server.listen(config.port, config.host, () => {
      log.info({ port: config.port, host: config.host }, 'Servidor HTTP iniciado');
      resolve(server);
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
