import Router from '@koa/router';
import { Context } from 'koa';
import { PlatformUserModel } from '../../db/models/PlatformUser';
import {
  approveOrganizationMember,
  ensureOrganizationInviteCode,
  hasActiveOrganizationMembership,
  listOrganizationMembers,
  regenerateOrganizationInviteCode,
  removeOrganizationMember,
} from '../../services/organizationTeamService';

/** Rotas de gestão de time e convites por organização. */
export const organizationTeamRouter = new Router();

/**
 * Garante que o usuário autenticado possui acesso ativo à organização da rota.
 * @param ctx Contexto Koa com usuário JWT
 * @returns ID da organização validada
 */
function assertActiveOrganizationAccess(ctx: Context): string {
  const organizationId = ctx.state.organizationId as string | undefined;
  const userId = (ctx.state.user as { id?: string } | undefined)?.id;
  if (!organizationId || !userId) {
    throw new Error('401 Contexto de organização inválido');
  }

  return organizationId;
}

/**
 * @openapi
 * /org/{orgId}/team/invite-code:
 *   get:
 *     tags:
 *       - Team
 *     summary: Retorna código de convite da organização
 */
organizationTeamRouter.get('/team/invite-code', async (ctx) => {
  try {
    const organizationId = assertActiveOrganizationAccess(ctx);
    const inviteCode = await ensureOrganizationInviteCode(organizationId);
    ctx.body = { inviteCode };
  } catch (error) {
    const message = (error as Error).message;
    ctx.status = message.startsWith('401') ? 401 : 400;
    ctx.body = { error: message.replace(/^\d+\s/, '') };
  }
});

/**
 * @openapi
 * /org/{orgId}/team/invite-code/regenerate:
 *   post:
 *     tags:
 *       - Team
 *     summary: Gera novo código de convite da organização
 */
organizationTeamRouter.post('/team/invite-code/regenerate', async (ctx) => {
  try {
    const organizationId = assertActiveOrganizationAccess(ctx);
    const inviteCode = await regenerateOrganizationInviteCode(organizationId);
    ctx.body = { inviteCode };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/team/members:
 *   get:
 *     tags:
 *       - Team
 *     summary: Lista membros e solicitações pendentes
 */
organizationTeamRouter.get('/team/members', async (ctx) => {
  try {
    const organizationId = assertActiveOrganizationAccess(ctx);
    const members = await listOrganizationMembers(organizationId);
    ctx.body = { members };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/team/members/{userId}/approve:
 *   post:
 *     tags:
 *       - Team
 *     summary: Aprova solicitação pendente de acesso
 */
organizationTeamRouter.post('/team/members/:userId/approve', async (ctx) => {
  try {
    const organizationId = assertActiveOrganizationAccess(ctx);
    const targetUserId = ctx.params.userId;
    await approveOrganizationMember(organizationId, targetUserId);
    const members = await listOrganizationMembers(organizationId);
    ctx.body = { members };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/team/members/{userId}:
 *   delete:
 *     tags:
 *       - Team
 *     summary: Remove membro ou rejeita solicitação pendente
 */
organizationTeamRouter.delete('/team/members/:userId', async (ctx) => {
  try {
    const organizationId = assertActiveOrganizationAccess(ctx);
    const targetUserId = ctx.params.userId;
    const requesterId = (ctx.state.user as { id: string }).id;

    if (targetUserId === requesterId) {
      ctx.status = 400;
      ctx.body = { error: 'Você não pode remover a si mesmo desta tela' };
      return;
    }

    const targetUser = await PlatformUserModel.findById(targetUserId).exec();
    if (!targetUser) {
      ctx.status = 404;
      ctx.body = { error: 'Usuário não encontrado' };
      return;
    }

    const membership = targetUser.memberships.find((item) => String(item.organizationId) === organizationId);
    if (membership?.role === 'owner') {
      ctx.status = 400;
      ctx.body = { error: 'Não é possível remover o proprietário da organização' };
      return;
    }

    await removeOrganizationMember(organizationId, targetUserId);
    const members = await listOrganizationMembers(organizationId);
    ctx.body = { members };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * Bloqueia rotas de gestão para usuários com membership pendente.
 * @param ctx Contexto Koa
 * @param next Próximo handler
 */
export async function assertTeamManagerAccess(ctx: Context, next: () => Promise<void>): Promise<void> {
  const organizationId = ctx.state.organizationId as string | undefined;
  const userId = (ctx.state.user as { id?: string } | undefined)?.id;
  if (!organizationId || !userId) {
    ctx.status = 401;
    ctx.body = { error: 'Não autorizado' };
    return;
  }

  const user = await PlatformUserModel.findById(userId).exec();
  if (!user || !hasActiveOrganizationMembership(user, organizationId)) {
    ctx.status = 403;
    ctx.body = { error: 'Acesso à organização ainda não aprovado' };
    return;
  }

  await next();
}
