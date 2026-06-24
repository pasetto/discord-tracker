import { Context, Next } from 'koa';
import { extractApiKey, isValidApiKey } from './auth';

/**
 * Exige API key válida para endpoints operacionais internos (métricas, health detalhado).
 * @param ctx Contexto Koa
 * @param next Próximo middleware
 */
export async function internalAuthMiddleware(ctx: Context, next: Next): Promise<void> {
  const apiKey = extractApiKey(ctx);
  if (!isValidApiKey(apiKey)) {
    ctx.status = 401;
    ctx.body = {
      error: 'Não autorizado',
      message: 'Endpoint restrito a operadores com API key',
    };
    return;
  }

  await next();
}
