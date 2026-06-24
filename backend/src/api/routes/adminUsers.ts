import Router from '@koa/router';
import {
  listAdminPlatformUsers,
  updateAdminPlatformUser,
  type UpdateAdminPlatformUserInput,
} from '../../services/adminPlatformService';
import { getPlatformUserId } from '../middleware/superAdmin';

/** Rotas super admin para gestão de usuários da plataforma. */
export const adminUsersRouter = new Router({ prefix: '/admin' });

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Lista usuários da plataforma
 */
adminUsersRouter.get('/users', async (ctx) => {
  const limit = Number(ctx.query.limit ?? 50);
  const skip = Number(ctx.query.skip ?? 0);
  const result = await listAdminPlatformUsers(limit, skip);
  ctx.body = result;
});

/**
 * @openapi
 * /admin/users/{userId}:
 *   patch:
 *     tags: [Admin]
 *     summary: Atualiza usuário (ex. promover super admin)
 */
adminUsersRouter.patch('/users/:userId', async (ctx) => {
  const actorId = getPlatformUserId(ctx);
  if (actorId === ctx.params.userId && ctx.request.body && (ctx.request.body as UpdateAdminPlatformUserInput).isSuperAdmin === false) {
    ctx.status = 400;
    ctx.body = { error: 'Você não pode remover seu próprio acesso de super admin' };
    return;
  }

  try {
    const user = await updateAdminPlatformUser(ctx.params.userId, ctx.request.body as UpdateAdminPlatformUserInput);
    if (!user) {
      ctx.status = 404;
      ctx.body = { error: 'Usuário não encontrado' };
      return;
    }
    ctx.body = { user };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});
