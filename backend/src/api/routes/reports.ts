import Router from '@koa/router';

/** Rotas de relatórios legados (descontinuadas por vazamento multitenant). */
export const reportsRouter = new Router();

const DEPRECATED_BODY = {
  error: 'Relatórios legados descontinuados',
  message:
    'Use os relatórios multitenant: inatividade, gamificação/ranking, metas e text-collaboration em /api/v1/org/:orgId/...',
};

/**
 * Bloqueia relatórios legados em `/org/:organizationId/reports/*` (sem guild multitenant).
 */
reportsRouter.all('/reports', (ctx) => {
  ctx.status = 410;
  ctx.body = DEPRECATED_BODY;
});

reportsRouter.all('/reports/(.*)', (ctx) => {
  ctx.status = 410;
  ctx.body = DEPRECATED_BODY;
});
