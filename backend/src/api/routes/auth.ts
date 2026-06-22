import Router from '@koa/router';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../../services/authService';
import { loginPlatformUser, registerPlatformUser } from '../../services/platformAuthService';
import { config } from '../../config/env';

/** Rotas públicas de autenticação com email e senha. */
export const authRouter = new Router();

/**
 * Define cookie HttpOnly de refresh token na resposta.
 * @param ctx Contexto Koa
 * @param refreshToken Token de renovação
 */
function setRefreshCookie(ctx: Router.RouterContext, refreshToken: string): void {
  ctx.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    secure: config.nodeEnv === 'production',
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
    maxAge: 0,
    secure: config.nodeEnv === 'production',
  });
  ctx.status = 204;
});
