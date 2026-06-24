import { Context, Next } from 'koa';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

/**
 * Opções do middleware de rate limiting em memória.
 */
export interface RateLimitOptions {
  /** Prefixo lógico do bucket (ex.: auth-login) */
  keyPrefix: string;
  /** Janela em milissegundos */
  windowMs: number;
  /** Máximo de requisições por janela */
  max: number;
}

/**
 * Cria middleware de rate limit simples por IP + prefixo.
 * @param options Configuração da janela e limite
 * @returns Middleware Koa
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  return async (ctx: Context, next: Next): Promise<void> => {
    const ip = ctx.ip || ctx.request.ip || 'unknown';
    const key = `${options.keyPrefix}:${ip}`;
    const now = Date.now();

    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      await next();
      return;
    }

    if (bucket.count >= options.max) {
      ctx.status = 429;
      ctx.set('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      ctx.body = { error: 'Muitas requisições. Tente novamente em instantes.' };
      return;
    }

    bucket.count += 1;
    await next();
  };
}

/**
 * Reseta buckets em memória — útil para testes.
 */
export function resetRateLimitBucketsForTests(): void {
  buckets.clear();
}
