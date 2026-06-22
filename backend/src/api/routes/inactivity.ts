import Router from '@koa/router';
import { Types } from 'mongoose';
import { getWeeklyInactivityReport } from '../../services/inactivityService';

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

const VIEWER_ROLES = new Set(['owner', 'admin', 'manager', 'viewer']);

/** Rotas de relatório core de inatividade ("quem sumiu"). */
export const inactivityRouter = new Router();

/**
 * Retorna identidade autenticada da requisição.
 * @param ctx Contexto Koa da requisição
 * @returns IDs de organização e usuário autenticado
 * @throws {Error} Quando contexto não possui identidade válida
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
 * Obtém role do usuário autenticado para a organização atual.
 * @param ctx Contexto Koa da requisição
 * @param organizationId Organização do tenant atual
 * @returns Papel normalizado em minúsculas
 */
function getMembershipRole(ctx: Router.RouterContext, organizationId: string): string | undefined {
  const user = ctx.state.user as JwtUserShape | undefined;
  const membership = user?.memberships?.find((item) => item.organizationId === organizationId);
  return membership?.role?.toLowerCase();
}

/**
 * Garante que usuário possui ao menos permissão de visualização.
 * @param ctx Contexto Koa da requisição
 * @param organizationId Organização do tenant atual
 * @returns {void} Não retorna valor
 */
function assertViewerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !VIEWER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para visualizar relatório de inatividade');
  }
}

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/reports/inactivity/weekly:
 *   get:
 *     tags:
 *       - Inactivity
 *     summary: Lista semanal de "quem sumiu" por guild
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Relatório semanal calculado para o gestor
 *       400:
 *         description: Parâmetros inválidos
 */
inactivityRouter.get('/guilds/:guildId/reports/inactivity/weekly', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertViewerRole(ctx, organizationId);

    const categoryId = typeof ctx.query.categoryId === 'string' ? ctx.query.categoryId : undefined;
    if (categoryId && !Types.ObjectId.isValid(categoryId)) {
      ctx.status = 400;
      ctx.body = { error: 'categoryId inválido' };
      return;
    }

    const report = await getWeeklyInactivityReport(organizationId, ctx.params.guildId, { categoryId }, new Date());
    ctx.body = { report };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});
