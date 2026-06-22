import { Context, Next } from 'koa';
import { Types } from 'mongoose';
import type { AuthUserPayload } from '../../services/authService';
import { PlatformUserModel } from '../../db/models/PlatformUser';

/**
 * Carrega usuário da plataforma autenticado via JWT.
 * @param ctx Contexto Koa da requisição
 * @returns Documento do usuário da plataforma
 */
async function resolvePlatformUser(ctx: Context) {
  const authUser = ctx.state.user as AuthUserPayload | undefined;
  if (!authUser?.discordId) {
    ctx.throw(401, 'Usuário autenticado inválido');
  }

  let platformUser = await PlatformUserModel.findOne({ discordId: authUser.discordId }).exec();
  if (!platformUser) {
    platformUser = await PlatformUserModel.create({
      discordId: authUser.discordId,
      displayName: authUser.username,
      isSuperAdmin: false,
      memberships: [],
    });
  }

  return platformUser;
}

/**
 * Garante que o usuário autenticado possui flag de super admin.
 * Injeta `ctx.state.platformUser` para handlers subsequentes.
 * @param ctx Contexto Koa da requisição
 * @param next Próximo middleware da cadeia
 * @returns {Promise<void>} Promise resolvida após autorização
 */
export async function superAdminMiddleware(ctx: Context, next: Next): Promise<void> {
  const platformUser = await resolvePlatformUser(ctx);

  if (!platformUser.isSuperAdmin) {
    ctx.status = 403;
    ctx.body = {
      error: 'Acesso negado',
      message: 'Somente super administradores podem acessar este recurso',
    };
    return;
  }

  ctx.state.platformUser = platformUser;
  await next();
}

/**
 * Retorna ID MongoDB do usuário autenticado para auditoria.
 * @param ctx Contexto Koa da requisição
 * @returns ObjectId do usuário da plataforma
 */
export function getPlatformUserId(ctx: Context): string {
  const platformUser = ctx.state.platformUser as { _id: Types.ObjectId } | undefined;
  if (!platformUser?._id) {
    throw new Error('platformUser ausente no contexto autenticado');
  }
  return String(platformUser._id);
}
