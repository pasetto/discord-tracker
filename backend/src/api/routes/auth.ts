import Router from '@koa/router';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../../services/authService';
import { loginPlatformUser, refreshPlatformUserSession, registerPlatformUser } from '../../services/platformAuthService';
import { config } from '../../config/env';

/** Rotas públicas de autenticação com email e senha. */
export const authRouter = new Router();

/**
 * Define se o cookie de refresh deve usar flag `secure`.
 * Em dev (HTTP) nunca força secure — evita erro do Koa em conexão não criptografada.
 * @param ctx Contexto Koa da requisição
 * @returns `true` somente em produção com conexão HTTPS (ou atrás de proxy confiável)
 */
function shouldUseSecureCookie(ctx: Router.RouterContext): boolean {
  if (process.env.COOKIE_SECURE === 'false') {
    return false;
  }
  if (process.env.COOKIE_SECURE === 'true') {
    return ctx.secure;
  }
  return config.nodeEnv === 'production' && ctx.secure;
}

/**
 * Define cookie HttpOnly de refresh token na resposta.
 * @param ctx Contexto Koa
 * @param refreshToken Token de renovação
 */
function setRefreshCookie(ctx: Router.RouterContext, refreshToken: string): void {
  ctx.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    secure: shouldUseSecureCookie(ctx),
  });
}

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Cadastra usuário e organização
 */
authRouter.post('/auth/register', async (ctx) => {
  const payload = ctx.request.body as {
    email?: string;
    password?: string;
    displayName?: string;
    organizationName?: string;
  };

  try {
    const result = await registerPlatformUser({
      email: payload.email ?? '',
      password: payload.password ?? '',
      displayName: payload.displayName ?? '',
      organizationName: payload.organizationName ?? '',
    });

    setRefreshCookie(ctx, result.refreshToken);
    ctx.status = 201;
    ctx.body = {
      accessToken: result.accessToken,
      user: result.user,
      organization: result.organization,
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Autentica usuário com email e senha
 */
authRouter.post('/auth/login', async (ctx) => {
  const payload = ctx.request.body as {
    email?: string;
    password?: string;
  };

  try {
    const result = await loginPlatformUser({
      email: payload.email ?? '',
      password: payload.password ?? '',
    });

    setRefreshCookie(ctx, result.refreshToken);
    ctx.body = {
      accessToken: result.accessToken,
      user: result.user,
      organization: result.organization,
    };
  } catch (error) {
    ctx.status = 401;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Renova access token usando cookie de refresh
 *     responses:
 *       200:
 *         description: Novo access token emitido
 *       401:
 *         description: Sessão expirada ou refresh token ausente
 */
authRouter.post('/auth/refresh', async (ctx) => {
  const refreshToken = ctx.cookies.get(REFRESH_COOKIE_NAME);
  if (!refreshToken) {
    ctx.status = 401;
    ctx.body = {
      error: 'Não autorizado',
      message: 'Sessão expirada. Faça login novamente.',
    };
    return;
  }

  try {
    const result = await refreshPlatformUserSession(refreshToken);
    setRefreshCookie(ctx, result.refreshToken);
    ctx.body = {
      accessToken: result.accessToken,
      user: result.user,
      organization: result.organization,
    };
  } catch {
    ctx.status = 401;
    ctx.body = {
      error: 'Não autorizado',
      message: 'Sessão expirada. Faça login novamente.',
    };
  }
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Encerra sessão removendo refresh token
 */
authRouter.post('/auth/logout', async (ctx) => {
  ctx.cookies.set(REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: shouldUseSecureCookie(ctx),
  });
  ctx.status = 204;
});
