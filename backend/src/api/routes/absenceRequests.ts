import Router from '@koa/router';
import { Types } from 'mongoose';
import {
  approveAbsenceRequest,
  listAbsenceRequests,
  rejectAbsenceRequest,
} from '../../services/plannedAbsenceService';
import { PlannedAbsenceStatus } from '../../db/models/PlannedAbsence';

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

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager']);
const ALLOWED_REQUEST_STATUS = new Set<PlannedAbsenceStatus>(['pending_approval']);

/** Rotas para fila de solicitações de ausência pendentes de aprovação. */
export const absenceRequestsRouter = new Router();

/**
 * Retorna identidade autenticada da requisição (org + user).
 * @param ctx Contexto Koa da requisição
 * @returns IDs autenticados para operações multitenant
 * @throws {Error} Quando contexto não possuir org/user válidos
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
 * Obtém papel do usuário autenticado para a organização atual.
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
 * Garante que usuário possui papel de gestão.
 * @param ctx Contexto Koa da requisição
 * @param organizationId Organização do tenant atual
 * @returns {void} Não retorna valor
 */
function assertManagerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !MANAGER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para gerenciar solicitações de ausência');
  }
}

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/absence-requests:
 *   get:
 *     tags:
 *       - Absence Requests
 *     summary: Lista solicitações de ausência por status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending_approval]
 *     responses:
 *       200:
 *         description: Lista de solicitações filtradas
 */
absenceRequestsRouter.get('/guilds/:guildId/absence-requests', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);

    const status = typeof ctx.query.status === 'string' ? (ctx.query.status as PlannedAbsenceStatus) : 'pending_approval';
    if (!ALLOWED_REQUEST_STATUS.has(status)) {
      ctx.status = 400;
      ctx.body = { error: 'status inválido' };
      return;
    }

    const requests = await listAbsenceRequests(organizationId, ctx.params.guildId, status);
    ctx.body = { requests };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/absence-requests/{id}/approve:
 *   post:
 *     tags:
 *       - Absence Requests
 *     summary: Aprova solicitação de ausência pendente
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Solicitação aprovada e convertida em ausência ativa/agendada
 *       404:
 *         description: Solicitação não encontrada
 */
absenceRequestsRouter.post('/guilds/:guildId/absence-requests/:id/approve', async (ctx) => {
  try {
    const { organizationId, userId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);

    if (!Types.ObjectId.isValid(ctx.params.id)) {
      ctx.status = 400;
      ctx.body = { error: 'id inválido' };
      return;
    }

    const request = await approveAbsenceRequest(organizationId, ctx.params.guildId, ctx.params.id, userId);
    if (!request) {
      ctx.status = 404;
      ctx.body = { error: 'Solicitação não encontrada' };
      return;
    }

    ctx.body = { request };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/absence-requests/{id}/reject:
 *   post:
 *     tags:
 *       - Absence Requests
 *     summary: Rejeita solicitação de ausência pendente
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Solicitação rejeitada e cancelada
 *       404:
 *         description: Solicitação não encontrada
 */
absenceRequestsRouter.post('/guilds/:guildId/absence-requests/:id/reject', async (ctx) => {
  try {
    const { organizationId, userId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);

    if (!Types.ObjectId.isValid(ctx.params.id)) {
      ctx.status = 400;
      ctx.body = { error: 'id inválido' };
      return;
    }

    const request = await rejectAbsenceRequest(organizationId, ctx.params.guildId, ctx.params.id, userId);
    if (!request) {
      ctx.status = 404;
      ctx.body = { error: 'Solicitação não encontrada' };
      return;
    }

    ctx.body = { request };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});
