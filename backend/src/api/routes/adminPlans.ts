import Router from '@koa/router';
import {
  createAdminPlan,
  getAdminPlanById,
  listAdminPlans,
  updateAdminPlan,
  type UpsertAdminPlanInput,
} from '../../services/adminPlanService';

/** Rotas super admin para CRUD de planos. */
export const adminPlansRouter = new Router({ prefix: '/admin' });

/**
 * @openapi
 * /admin/plans:
 *   get:
 *     tags: [Admin]
 *     summary: Lista planos do catálogo (super admin)
 */
adminPlansRouter.get('/plans', async (ctx) => {
  const plans = await listAdminPlans();
  ctx.body = { plans };
});

/**
 * @openapi
 * /admin/plans/{planId}:
 *   get:
 *     tags: [Admin]
 *     summary: Detalhe de um plano
 */
adminPlansRouter.get('/plans/:planId', async (ctx) => {
  const plan = await getAdminPlanById(ctx.params.planId);
  if (!plan) {
    ctx.status = 404;
    ctx.body = { error: 'Plano não encontrado' };
    return;
  }
  ctx.body = { plan };
});

/**
 * @openapi
 * /admin/plans:
 *   post:
 *     tags: [Admin]
 *     summary: Cria plano no catálogo
 */
adminPlansRouter.post('/plans', async (ctx) => {
  try {
    const plan = await createAdminPlan(ctx.request.body as UpsertAdminPlanInput);
    ctx.status = 201;
    ctx.body = { plan };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /admin/plans/{planId}:
 *   patch:
 *     tags: [Admin]
 *     summary: Atualiza plano existente
 */
adminPlansRouter.patch('/plans/:planId', async (ctx) => {
  try {
    const plan = await updateAdminPlan(ctx.params.planId, ctx.request.body as Partial<UpsertAdminPlanInput>);
    if (!plan) {
      ctx.status = 404;
      ctx.body = { error: 'Plano não encontrado' };
      return;
    }
    ctx.body = { plan };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});
