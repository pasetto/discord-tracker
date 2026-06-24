import Router from '@koa/router';
import { listAdminOrganizations } from '../../services/adminPlatformService';

/** Rotas super admin para listagem de organizações (tenants). */
export const adminOrganizationsRouter = new Router({ prefix: '/admin' });

/**
 * @openapi
 * /admin/organizations:
 *   get:
 *     tags: [Admin]
 *     summary: Lista organizações da plataforma
 */
adminOrganizationsRouter.get('/organizations', async (ctx) => {
  const limit = Number(ctx.query.limit ?? 50);
  const skip = Number(ctx.query.skip ?? 0);
  const result = await listAdminOrganizations(limit, skip);
  ctx.body = result;
});
