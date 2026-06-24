import Router from '@koa/router';
import { Types } from 'mongoose';
import {
  assignTrackedUserCategory,
  bulkAssignTrackedUsersCategory,
  listTrackedUsers,
  syncTrackedUsersFromDiscordGuild,
} from '../../services/trackedUserService';

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
const MANAGER_ROLES = new Set(['owner', 'admin', 'manager']);

/** Rotas de membros rastreados por guild. */
export const trackedUsersRouter = new Router();

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
 * Garante permissão mínima de visualização.
 * @param ctx Contexto Koa da requisição
 * @param organizationId Organização do tenant atual
 */
function assertViewerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !VIEWER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para visualizar membros rastreados');
  }
}

/**
 * Garante permissão de gestão.
 * @param ctx Contexto Koa da requisição
 * @param organizationId Organização do tenant atual
 */
function assertManagerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !MANAGER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para sincronizar membros');
  }
}

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/tracked-users:
 *   get:
 *     tags:
 *       - Members
 *     summary: Lista membros rastreados do servidor
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de membros rastreados
 */
trackedUsersRouter.get('/guilds/:guildId/tracked-users', async (ctx) => {
  try {
    const organizationId = ctx.state.organizationId as string | undefined;
    if (!organizationId) {
      ctx.status = 400;
      ctx.body = { error: 'organizationId ausente no contexto autenticado' };
      return;
    }

    assertViewerRole(ctx, organizationId);
    const members = await listTrackedUsers(organizationId, ctx.params.guildId);
    ctx.body = { members };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/tracked-users/sync:
 *   post:
 *     tags:
 *       - Members
 *     summary: Sincroniza membros do Discord para rastreamento
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sincronização concluída
 */
trackedUsersRouter.post('/guilds/:guildId/tracked-users/sync', async (ctx) => {
  try {
    const organizationId = ctx.state.organizationId as string | undefined;
    if (!organizationId || !Types.ObjectId.isValid(organizationId)) {
      ctx.status = 400;
      ctx.body = { error: 'organizationId inválido' };
      return;
    }

    assertManagerRole(ctx, organizationId);
    const result = await syncTrackedUsersFromDiscordGuild(organizationId, ctx.params.guildId);
    const members = await listTrackedUsers(organizationId, ctx.params.guildId);
    ctx.body = { ...result, members };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/tracked-users/category-assignments:
 *   put:
 *     tags:
 *       - Members
 *     summary: Atribui categorias em lote aos membros rastreados
 */
trackedUsersRouter.put('/guilds/:guildId/tracked-users/category-assignments', async (ctx) => {
  try {
    const organizationId = ctx.state.organizationId as string | undefined;
    if (!organizationId || !Types.ObjectId.isValid(organizationId)) {
      ctx.status = 400;
      ctx.body = { error: 'organizationId inválido' };
      return;
    }

    assertManagerRole(ctx, organizationId);

    const payload = ctx.request.body as {
      assignments?: Array<{ trackedUserId?: string; categoryId?: string | null }>;
    };

    const assignments = (payload.assignments ?? [])
      .filter((item) => item.trackedUserId && Types.ObjectId.isValid(item.trackedUserId))
      .map((item) => ({
        trackedUserId: item.trackedUserId as string,
        categoryId:
          item.categoryId === null || item.categoryId === undefined || item.categoryId === ''
            ? null
            : item.categoryId,
      }));

    if (assignments.length === 0) {
      ctx.status = 400;
      ctx.body = { error: 'Informe ao menos um membro em assignments' };
      return;
    }

    for (const assignment of assignments) {
      if (assignment.categoryId && !Types.ObjectId.isValid(assignment.categoryId)) {
        ctx.status = 400;
        ctx.body = { error: 'categoryId inválido em assignments' };
        return;
      }
    }

    const members = await bulkAssignTrackedUsersCategory(organizationId, ctx.params.guildId, assignments);
    ctx.body = { members };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/tracked-users/{trackedUserId}/category:
 *   put:
 *     tags:
 *       - Members
 *     summary: Atribui categoria a um membro rastreado
 */
trackedUsersRouter.put('/guilds/:guildId/tracked-users/:trackedUserId/category', async (ctx) => {
  try {
    const organizationId = ctx.state.organizationId as string | undefined;
    if (!organizationId || !Types.ObjectId.isValid(organizationId)) {
      ctx.status = 400;
      ctx.body = { error: 'organizationId inválido' };
      return;
    }

    if (!Types.ObjectId.isValid(ctx.params.trackedUserId)) {
      ctx.status = 400;
      ctx.body = { error: 'trackedUserId inválido' };
      return;
    }

    assertManagerRole(ctx, organizationId);

    const payload = ctx.request.body as { categoryId?: string | null };
    const categoryId =
      payload.categoryId === null || payload.categoryId === undefined || payload.categoryId === ''
        ? null
        : payload.categoryId;

    if (categoryId && !Types.ObjectId.isValid(categoryId)) {
      ctx.status = 400;
      ctx.body = { error: 'categoryId inválido' };
      return;
    }

    const member = await assignTrackedUserCategory(
      organizationId,
      ctx.params.guildId,
      ctx.params.trackedUserId,
      categoryId,
    );

    ctx.body = { member };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});
