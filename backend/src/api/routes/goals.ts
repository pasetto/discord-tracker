import Router from '@koa/router';
import { Types, isValidObjectId } from 'mongoose';
import { CategoryGoalTemplateModel } from '../../db/models/CategoryGoalTemplate';
import { applyCategoryGoalsToTrackedUsers, getGoalsWeeklyReport } from '../../services/goalsService';

/**
 * Membership de organização presente no JWT.
 */
interface JwtMembership {
  organizationId: string;
  role: string;
}

/**
 * Shape mínimo do usuário autenticado em `ctx.state.user`.
 */
interface JwtUserShape {
  id?: string;
  memberships?: JwtMembership[];
}

/**
 * Payload para criação/atualização de template de meta por categoria.
 */
interface CategoryGoalTemplatePayload {
  weeklyCollaborationHours?: number;
  dailyMinimumHours?: number;
}

const VIEWER_ROLES = new Set(['owner', 'admin', 'manager', 'viewer']);
const MANAGER_ROLES = new Set(['owner', 'admin', 'manager']);

/** Rotas de metas individuais e templates por categoria. */
export const goalsRouter = new Router();

/**
 * Obtém role do usuário autenticado para a organização atual.
 * @param {Router.RouterContext} ctx Contexto Koa da requisição
 * @param {string} organizationId Organização do tenant atual
 * @returns {string | undefined} Papel normalizado em minúsculas
 */
function getMembershipRole(ctx: Router.RouterContext, organizationId: string): string | undefined {
  const user = ctx.state.user as JwtUserShape | undefined;
  const membership = user?.memberships?.find((item) => item.organizationId === organizationId);
  return membership?.role?.toLowerCase();
}

/**
 * Garante permissão mínima de visualização de metas.
 * @param {Router.RouterContext} ctx Contexto Koa da requisição
 * @param {string} organizationId Organização do tenant atual
 * @returns {void} Não retorna valor
 */
function assertViewerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !VIEWER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para visualizar metas');
  }
}

/**
 * Garante permissão de gestão para mutações de metas.
 * @param {Router.RouterContext} ctx Contexto Koa da requisição
 * @param {string} organizationId Organização do tenant atual
 * @returns {void} Não retorna valor
 */
function assertManagerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !MANAGER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para gerenciar metas');
  }
}

/**
 * Extrai dados de identificação da requisição autenticada.
 * @param {Router.RouterContext} ctx Contexto Koa da requisição
 * @returns {{ organizationId: string; userId: string }} IDs de organização e usuário
 * @throws {Error} Quando contexto não possui tenant/usuário válidos
 */
function getRequestIdentity(ctx: Router.RouterContext): { organizationId: string; userId: string } {
  const organizationId = ctx.state.organizationId as string | undefined;
  const userId = (ctx.state.user as JwtUserShape | undefined)?.id;

  if (!organizationId) {
    throw new Error('organizationId ausente no contexto autenticado');
  }
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new Error('Usuário autenticado inválido');
  }

  return { organizationId, userId };
}

/**
 * Valida payload de template por categoria.
 * @param {CategoryGoalTemplatePayload | undefined} payload Body recebido
 * @returns {{ weeklyCollaborationHours: number; dailyMinimumHours?: number }} Valores normalizados para persistência
 * @throws {Error} Quando os campos numéricos forem inválidos
 */
function validateTemplatePayload(
  payload: CategoryGoalTemplatePayload | undefined,
): { weeklyCollaborationHours: number; dailyMinimumHours?: number } {
  const weeklyCollaborationHours = Number(payload?.weeklyCollaborationHours);
  if (!Number.isFinite(weeklyCollaborationHours) || weeklyCollaborationHours < 0) {
    throw new Error('weeklyCollaborationHours deve ser um número maior ou igual a 0');
  }

  const hasDailyMinimumHours = payload?.dailyMinimumHours !== undefined;
  const dailyMinimumHours = hasDailyMinimumHours ? Number(payload?.dailyMinimumHours) : undefined;
  if (hasDailyMinimumHours && (!Number.isFinite(dailyMinimumHours) || (dailyMinimumHours ?? 0) < 0)) {
    throw new Error('dailyMinimumHours deve ser um número maior ou igual a 0');
  }

  return {
    weeklyCollaborationHours,
    dailyMinimumHours,
  };
}

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/categories/goal-templates:
 *   get:
 *     tags:
 *       - Goals
 *     summary: Lista templates de meta por categoria no guild
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de templates por categoria
 */
goalsRouter.get('/guilds/:guildId/categories/goal-templates', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertViewerRole(ctx, organizationId);

    const templates = await CategoryGoalTemplateModel.find({
      organizationId,
      guildId: ctx.params.guildId,
    })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    ctx.body = { templates };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/categories/{categoryId}/goal-template:
 *   get:
 *     tags:
 *       - Goals
 *     summary: Retorna template de meta de uma categoria
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Template encontrado
 *       404:
 *         description: Template não existe para categoria
 */
goalsRouter.get('/guilds/:guildId/categories/:categoryId/goal-template', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertViewerRole(ctx, organizationId);

    if (!isValidObjectId(ctx.params.categoryId)) {
      ctx.status = 400;
      ctx.body = { error: 'categoryId inválido' };
      return;
    }

    const template = await CategoryGoalTemplateModel.findOne({
      organizationId,
      guildId: ctx.params.guildId,
      categoryId: ctx.params.categoryId,
    })
      .lean()
      .exec();

    if (!template) {
      ctx.status = 404;
      ctx.body = { error: 'Template de meta não encontrado para a categoria' };
      return;
    }

    ctx.body = { template };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/categories/{categoryId}/goal-template:
 *   put:
 *     tags:
 *       - Goals
 *     summary: Cria ou atualiza template de meta de categoria
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Template atualizado com sucesso
 */
goalsRouter.put('/guilds/:guildId/categories/:categoryId/goal-template', async (ctx) => {
  try {
    const { organizationId, userId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);

    if (!isValidObjectId(ctx.params.categoryId)) {
      ctx.status = 400;
      ctx.body = { error: 'categoryId inválido' };
      return;
    }

    const payload = validateTemplatePayload(ctx.request.body as CategoryGoalTemplatePayload | undefined);
    const template = await CategoryGoalTemplateModel.findOneAndUpdate(
      {
        organizationId,
        guildId: ctx.params.guildId,
        categoryId: ctx.params.categoryId,
      },
      {
        $set: {
          weeklyCollaborationHours: payload.weeklyCollaborationHours,
          dailyMinimumHours: payload.dailyMinimumHours,
          setBy: new Types.ObjectId(userId),
        },
        $setOnInsert: {
          organizationId: new Types.ObjectId(organizationId),
          guildId: ctx.params.guildId,
          categoryId: new Types.ObjectId(ctx.params.categoryId),
        },
      },
      { upsert: true, new: true },
    )
      .lean()
      .exec();

    ctx.body = { template };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/categories/{categoryId}/goal-template:
 *   delete:
 *     tags:
 *       - Goals
 *     summary: Remove template de meta de categoria
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Template removido
 *       404:
 *         description: Template não encontrado
 */
goalsRouter.delete('/guilds/:guildId/categories/:categoryId/goal-template', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);

    if (!isValidObjectId(ctx.params.categoryId)) {
      ctx.status = 400;
      ctx.body = { error: 'categoryId inválido' };
      return;
    }

    const deleted = await CategoryGoalTemplateModel.findOneAndDelete({
      organizationId,
      guildId: ctx.params.guildId,
      categoryId: ctx.params.categoryId,
    })
      .lean()
      .exec();

    if (!deleted) {
      ctx.status = 404;
      ctx.body = { error: 'Template de meta não encontrado para a categoria' };
      return;
    }

    ctx.status = 204;
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/members/apply-category-goals:
 *   post:
 *     tags:
 *       - Goals
 *     summary: Aplica template da categoria para metas individuais dos membros
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metas aplicadas para os membros da categoria
 */
goalsRouter.post('/guilds/:guildId/members/apply-category-goals', async (ctx) => {
  try {
    const { organizationId, userId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);

    const categoryId = (ctx.request.body as { categoryId?: string } | undefined)?.categoryId;
    if (!categoryId || !isValidObjectId(categoryId)) {
      ctx.status = 400;
      ctx.body = { error: 'categoryId inválido' };
      return;
    }

    const result = await applyCategoryGoalsToTrackedUsers({
      organizationId,
      guildId: ctx.params.guildId,
      categoryId,
      setBy: userId,
    });

    ctx.body = { result };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/reports/goals:
 *   get:
 *     tags:
 *       - Goals
 *     summary: Retorna relatório semanal de meta versus realizado por usuário
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Relatório semanal de metas individuais
 */
goalsRouter.get('/guilds/:guildId/reports/goals', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertViewerRole(ctx, organizationId);

    const categoryId = typeof ctx.query.categoryId === 'string' ? ctx.query.categoryId : undefined;
    if (categoryId && !isValidObjectId(categoryId)) {
      ctx.status = 400;
      ctx.body = { error: 'categoryId inválido' };
      return;
    }

    const report = await getGoalsWeeklyReport({
      organizationId,
      guildId: ctx.params.guildId,
      categoryId,
    });

    ctx.body = { report };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});
