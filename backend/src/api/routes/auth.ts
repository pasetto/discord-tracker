import Router from '@koa/router';
import { randomUUID } from 'crypto';
import {
  buildDiscordAuthorizeUrl,
  exchangeDiscordCodeForToken,
  fetchDiscordOAuthUser,
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_SECONDS,
  signAccessToken,
  signRefreshToken,
  type AuthUserPayload,
} from '../../services/authService';
import { config } from '../../config/env';

/** Rotas públicas de autenticação OAuth2 com Discord. */
export const authRouter = new Router();

/**
 * Monta URL absoluta de callback OAuth considerando host da requisição.
 * @param protocol Protocolo HTTP da requisição
 * @param host Host HTTP da requisição
 * @returns URL de callback para o Discord redirecionar
 */
function buildCallbackUrl(protocol: string, host: string): string {
  return `${protocol}://${host}/api/v1/auth/discord/callback`;
}

/**
 * GET /auth/discord - Inicia o fluxo OAuth2 e redireciona para o Discord.
 */
authRouter.get('/auth/discord', async (ctx) => {
  const state = randomUUID();
  const redirectUri = buildCallbackUrl(ctx.protocol, ctx.host);

  try {
    const authorizeUrl = await buildDiscordAuthorizeUrl(redirectUri, state);
    ctx.cookies.set('syntra_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      secure: config.nodeEnv === 'production',
    });
    ctx.redirect(authorizeUrl);
  } catch (error) {
    ctx.status = 503;
    ctx.body = {
      error: 'OAuth Discord indisponível',
      message: (error as Error).message,
    };
  }
});

/**
 * GET /auth/discord/callback - Processa callback OAuth2, gera JWT e cookie refresh.
 */
authRouter.get('/auth/discord/callback', async (ctx) => {
  const code = ctx.query.code;
  const state = ctx.query.state;
  const expectedState = ctx.cookies.get('syntra_oauth_state');

  if (typeof code !== 'string' || typeof state !== 'string' || !expectedState || state !== expectedState) {
    ctx.status = 400;
    ctx.body = { error: 'Parâmetros OAuth inválidos' };
    return;
  }

  try {
    const redirectUri = buildCallbackUrl(ctx.protocol, ctx.host);
    const discordAccessToken = await exchangeDiscordCodeForToken(code, redirectUri);
    const discordUser = await fetchDiscordOAuthUser(discordAccessToken);

    const authUser: AuthUserPayload = {
      id: discordUser.id,
      discordId: discordUser.id,
      username: discordUser.username,
      memberships: [],
    };

    const accessToken = signAccessToken(authUser);
    const refreshToken = signRefreshToken(authUser);

    ctx.cookies.set(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
      secure: config.nodeEnv === 'production',
    });

    const frontendTarget = new URL('/auth/callback', config.frontendUrl);
    frontendTarget.searchParams.set('accessToken', accessToken);
    ctx.redirect(frontendTarget.toString());
  } catch {
    ctx.status = 502;
    ctx.body = { error: 'Falha ao autenticar com Discord' };
  }
});
