import Router from '@koa/router';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../../services/authService';
import {
  getPlatformAuthSession,
  loginPlatformUser,
  refreshPlatformUserSession,
  registerPlatformUser,
  switchPlatformOrganization,
} from '../../services/platformAuthService';
import { requestOrganizationJoin } from '../../services/organizationTeamService';
import {
  completePasswordReset,
  requestPublicPasswordReset,
} from '../../services/betterAuthBridgeService';
import { config } from '../../config/env';

/** Rotas públicas de autenticação com email e senha. */
export const authRouter = new Router();

/** Rotas autenticadas de sessão e organizações do usuário. */
export const authSessionRouter = new Router();

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
 * @param options Opções de persistência (`rememberMe: false` = cookie de sessão do navegador)
 */
function setRefreshCookie(
  ctx: Router.RouterContext,
  refreshToken: string,
  options?: { rememberMe?: boolean },
): void {
  const rememberMe = options?.rememberMe !== false;

  ctx.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    ...(rememberMe ? { maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000 } : {}),
    secure: shouldUseSecureCookie(ctx),
  });
}

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Cadastra usuário e organização (ou entra via convite)
 */
authRouter.post('/auth/register', async (ctx) => {
  const payload = ctx.request.body as {
    email?: string;
    password?: string;
    displayName?: string;
    organizationName?: string;
    inviteCode?: string;
  };

  try {
    const result = await registerPlatformUser({
      email: payload.email ?? '',
      password: payload.password ?? '',
      displayName: payload.displayName ?? '',
      organizationName: payload.organizationName,
      inviteCode: payload.inviteCode,
    });

    setRefreshCookie(ctx, result.refreshToken);
    ctx.status = 201;
    ctx.body = {
      accessToken: result.accessToken,
      user: result.user,
      organization: result.organization,
      organizations: result.organizations,
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
    rememberMe?: boolean;
  };

  try {
    const result = await loginPlatformUser({
      email: payload.email ?? '',
      password: payload.password ?? '',
    });

    setRefreshCookie(ctx, result.refreshToken, { rememberMe: payload.rememberMe !== false });
    ctx.body = {
      accessToken: result.accessToken,
      user: result.user,
      organization: result.organization,
      organizations: result.organizations,
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
      organizations: result.organizations,
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

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Solicita email de redefinição de senha (resposta genérica)
 */
authRouter.post('/auth/forgot-password', async (ctx) => {
  const payload = ctx.request.body as { email?: string };
  await requestPublicPasswordReset(payload.email ?? '');
  ctx.body = {
    ok: true,
    message: 'Se o email existir, enviaremos instruções para redefinir a senha.',
  };
});

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Redefine senha com token Better Auth
 */
authRouter.post('/auth/reset-password', async (ctx) => {
  const payload = ctx.request.body as { token?: string; newPassword?: string };
  try {
    await completePasswordReset({
      token: payload.token ?? '',
      newPassword: payload.newPassword ?? '',
    });
    ctx.body = { ok: true };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Retorna sessão atual e organizações do usuário
 */
authSessionRouter.get('/auth/me', async (ctx) => {
  const user = ctx.state.user as { id?: string } | undefined;
  if (!user?.id) {
    ctx.status = 401;
    ctx.body = { error: 'Não autorizado' };
    return;
  }

  try {
    const result = await getPlatformAuthSession(user.id);
    ctx.body = {
      user: result.user,
      organization: result.organization,
      organizations: result.organizations,
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /auth/join-organization:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Solicita entrada em organização via código de convite
 */
authSessionRouter.post('/auth/join-organization', async (ctx) => {
  const user = ctx.state.user as { id?: string } | undefined;
  const payload = ctx.request.body as { inviteCode?: string } | undefined;

  if (!user?.id) {
    ctx.status = 401;
    ctx.body = { error: 'Não autorizado' };
    return;
  }

  try {
    await requestOrganizationJoin(user.id, payload?.inviteCode ?? '');
    const result = await getPlatformAuthSession(user.id);
    setRefreshCookie(ctx, result.refreshToken);
    ctx.body = {
      accessToken: result.accessToken,
      user: result.user,
      organization: result.organization,
      organizations: result.organizations,
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /auth/switch-organization:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Define organização ativa no cliente
 */
authSessionRouter.post('/auth/switch-organization', async (ctx) => {
  const user = ctx.state.user as { id?: string } | undefined;
  const payload = ctx.request.body as { organizationId?: string } | undefined;

  if (!user?.id) {
    ctx.status = 401;
    ctx.body = { error: 'Não autorizado' };
    return;
  }

  try {
    const result = await switchPlatformOrganization(user.id, payload?.organizationId ?? '');
    setRefreshCookie(ctx, result.refreshToken);
    ctx.body = {
      accessToken: result.accessToken,
      user: result.user,
      organization: result.organization,
      organizations: result.organizations,
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});
