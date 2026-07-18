import { Context, Next } from 'koa';
import { timingSafeEqual } from 'crypto';
import { config } from '../../config/env';
import { createLogger } from '../../logger';

const log = createLogger('auth');

/** Nome do cookie legado que ainda aceita API key em requisições. */
const AUTH_COOKIE_NAME = 'tracker_api_key';

/** Rotas públicas que não exigem autenticação. */
export const PUBLIC_PATHS = new Set([
  '/health',
  '/health/live',
  '/health/ready',
  '/health/alerts',
  '/health/details',
]);


/**
 * Faz parse do header Cookie.
 * @param header Valor bruto do header Cookie
 * @returns Mapa chave-valor dos cookies
 */
function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header.split(';').map((chunk) => {
      const [key, ...valueParts] = chunk.trim().split('=');
      return [key, decodeURIComponent(valueParts.join('='))];
    }),
  );
}

/**
 * Compara duas strings de forma segura contra timing attacks.
 * @param provided Valor recebido na requisição
 * @param expected Valor esperado
 * @returns true se forem iguais
 */
function safeCompare(provided: string, expected: string): boolean {
  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);

  if (providedBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Verifica se a chave informada é uma API key válida.
 * @param apiKey Chave recebida
 * @returns true se autorizada
 */
export function isValidApiKey(apiKey: string | undefined): boolean {
  if (!apiKey) {
    return false;
  }

  return config.apiKeys.some((key) => safeCompare(apiKey, key));
}

/**
 * Extrai API key do header Authorization, X-API-Key ou cookie.
 * @param ctx Contexto Koa
 * @returns Chave encontrada ou undefined
 */
export function extractApiKey(ctx: Context): string | undefined {
  const authorization = ctx.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }

  const headerKey = ctx.headers['x-api-key'];
  if (typeof headerKey === 'string' && headerKey.trim()) {
    return headerKey.trim();
  }

  const cookies = parseCookies(ctx.headers.cookie);
  const cookieKey = cookies[AUTH_COOKIE_NAME];
  if (cookieKey) {
    return cookieKey;
  }

  return undefined;
}

/**
 * Middleware de autenticação por API key.
 * Rotas em PUBLIC_PATHS são liberadas.
 * @param ctx Contexto Koa
 * @param next Próximo middleware
 */
export async function authMiddleware(ctx: Context, next: Next): Promise<void> {
  const path = ctx.path;

  if (PUBLIC_PATHS.has(path)) {
    await next();
    return;
  }

  const apiKey = extractApiKey(ctx);

  if (!isValidApiKey(apiKey)) {
    log.warn({ path, ip: ctx.ip }, 'Tentativa de acesso não autorizado');

    ctx.status = 401;
    ctx.body = {
      error: 'Não autorizado',
      message: 'Informe API key via Authorization: Bearer ou X-API-Key',
    };
    return;
  }

  await next();
}
