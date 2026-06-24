import Router from '@koa/router';

/** Rotas legadas descontinuadas (sem isolamento multitenant). */
export const legacyDeprecatedRouter = new Router();

const DEPRECATED_BODY = {
  error: 'Rotas legadas descontinuadas',
  message: 'Use a API versionada em /api/v1 com autenticação JWT',
};

/**
 * Responde 410 Gone para endpoints legados pré-multitenant.
 * @param ctx Contexto Koa
 */
function respondDeprecated(ctx: Router.RouterContext): void {
  ctx.status = 410;
  ctx.body = DEPRECATED_BODY;
}

legacyDeprecatedRouter.all('/reports', respondDeprecated);
legacyDeprecatedRouter.all('/reports/(.*)', respondDeprecated);
legacyDeprecatedRouter.all('/stats', respondDeprecated);
legacyDeprecatedRouter.all('/stats/(.*)', respondDeprecated);
