import type { Context, Next } from 'koa';

/** Origens permitidas para CORS (separadas por vírgula no env). */
const ALLOWED = (process.env.CORS_ORIGIN ?? 'http://localhost:4200').split(',');

/**
 * Middleware CORS para permitir requisições do frontend Angular em desenvolvimento.
 * @param ctx Contexto Koa
 * @param next Próximo middleware
 */
export async function corsMiddleware(ctx: Context, next: Next): Promise<void> {
  const origin = ctx.get('Origin');
  if (origin && ALLOWED.includes(origin)) {
    ctx.set('Access-Control-Allow-Origin', origin);
    ctx.set('Access-Control-Allow-Credentials', 'true');
    ctx.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    ctx.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  }
  if (ctx.method === 'OPTIONS') {
    ctx.status = 204;
    return;
  }
  await next();
}
