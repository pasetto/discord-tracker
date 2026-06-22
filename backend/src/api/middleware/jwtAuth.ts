import { Context, Next } from 'koa';
import { verifyAccessToken } from '../../services/authService';

/**
 * Extrai token Bearer do header Authorization.
 * @param authorization Header Authorization bruto
 * @returns Token JWT sem prefixo Bearer ou undefined
 */
function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }

  const token = authorization.slice(7).trim();
  return token || undefined;
}

/**
 * Valida JWT Bearer e injeta usuário autenticado em ctx.state.user.
 * @param ctx Contexto Koa da requisição
 * @param next Próximo middleware da cadeia
 * @returns {Promise<void>} Promise resolvida após autenticação e execução
 */
export async function jwtAuth(ctx: Context, next: Next): Promise<void> {
  const token = extractBearerToken(ctx.get('Authorization'));
  if (!token) {
    ctx.status = 401;
    ctx.body = {
      error: 'Não autorizado',
      message: 'Informe JWT via Authorization: Bearer <token>',
    };
    return;
  }

  try {
    ctx.state.user = verifyAccessToken(token);
    await next();
  } catch {
    ctx.status = 401;
    ctx.body = {
      error: 'Não autorizado',
      message: 'JWT inválido ou expirado',
    };
  }
}
