import jwt, { JwtPayload } from 'jsonwebtoken';
import { config } from '../config/env';

/** Tempo de expiração do access token em segundos (15 minutos). */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Tempo de expiração do refresh token em segundos (7 dias). */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Nome do cookie HttpOnly usado para armazenar o refresh token. */
export const REFRESH_COOKIE_NAME = 'syntra_refresh';

/**
 * Membership de organização incluída no JWT.
 */
export interface AuthMembership {
  organizationId: string;
  role: string;
}

/**
 * Payload autenticado usado pelos tokens da aplicação.
 */
export interface AuthUserPayload {
  id: string;
  discordId: string;
  username: string;
  memberships: AuthMembership[];
}

/**
 * Resposta da troca de código OAuth por token no Discord.
 */
interface DiscordTokenExchangeResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

/**
 * Perfil básico retornado pelo endpoint /users/@me do Discord.
 */
export interface DiscordOAuthUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

/**
 * Assina um access token JWT para autenticação de API.
 * @param payload Usuário autenticado e memberships
 * @returns JWT assinado com validade de 15 minutos
 */
export function signAccessToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    subject: payload.id,
  });
}

/**
 * Assina um refresh token JWT para renovação de sessão.
 * @param payload Usuário autenticado e memberships
 * @returns JWT assinado com validade de 7 dias
 */
export function signRefreshToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    subject: payload.id,
  });
}

/**
 * Verifica e decodifica um access token JWT.
 * @param token JWT recebido no header Authorization
 * @returns Payload de usuário autenticado
 * @throws {Error} Quando token é inválido, expirado ou sem payload compatível
 */
export function verifyAccessToken(token: string): AuthUserPayload {
  return verifyTokenPayload(token);
}

/**
 * Verifica e decodifica um refresh token JWT.
 * @param token JWT recebido via cookie HttpOnly
 * @returns Payload de usuário autenticado
 * @throws {Error} Quando token é inválido, expirado ou sem payload compatível
 */
export function verifyRefreshToken(token: string): AuthUserPayload {
  return verifyTokenPayload(token);
}

/**
 * Troca o authorization code OAuth2 por access token do Discord.
 * @param code Authorization code recebido no callback
 * @param redirectUri URL de callback usada na autorização
 * @returns Access token OAuth retornado pelo Discord
 * @throws {Error} Quando o Discord retorna erro na troca
 */
export async function exchangeDiscordCodeForToken(
  code: string,
  redirectUri: string,
): Promise<string> {
  const body = new URLSearchParams({
    client_id: config.discordOauthClientId,
    client_secret: config.discordOauthClientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Discord OAuth token exchange falhou com status ${response.status}`);
  }

  const payload = (await response.json()) as DiscordTokenExchangeResponse;
  if (!payload.access_token) {
    throw new Error('Discord OAuth token exchange retornou access_token vazio');
  }

  return payload.access_token;
}

/**
 * Obtém o usuário autenticado no Discord usando access token OAuth.
 * @param discordAccessToken Access token obtido no OAuth2
 * @returns Perfil básico do usuário no Discord
 * @throws {Error} Quando o Discord retorna erro ao buscar usuário
 */
export async function fetchDiscordOAuthUser(discordAccessToken: string): Promise<DiscordOAuthUser> {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${discordAccessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Discord OAuth user fetch falhou com status ${response.status}`);
  }

  const payload = (await response.json()) as DiscordOAuthUser;
  if (!payload.id || !payload.username) {
    throw new Error('Discord OAuth user payload inválido');
  }

  return payload;
}

/**
 * Gera URL de autorização OAuth2 do Discord para login.
 * @param redirectUri URL absoluta de callback no backend
 * @param state Valor opaco de proteção de fluxo OAuth (CSRF)
 * @returns URL completa para redirecionamento ao Discord
 */
export function buildDiscordAuthorizeUrl(redirectUri: string, state: string): string {
  const query = new URLSearchParams({
    client_id: config.discordOauthClientId,
    response_type: 'code',
    scope: 'identify',
    redirect_uri: redirectUri,
    state,
    prompt: 'consent',
  });

  return `https://discord.com/oauth2/authorize?${query.toString()}`;
}

/**
 * Verifica e converte payload JWT para shape AuthUserPayload.
 * @param token JWT assinado pela aplicação
 * @returns Payload validado para autenticação
 * @throws {Error} Quando payload não está no formato esperado
 */
function verifyTokenPayload(token: string): AuthUserPayload {
  const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload | string;

  if (typeof decoded === 'string') {
    throw new Error('JWT inválido: payload textual não suportado');
  }

  const payload = decoded as Partial<AuthUserPayload>;
  if (!payload.id || !payload.discordId || !payload.username || !Array.isArray(payload.memberships)) {
    throw new Error('JWT inválido: payload incompleto');
  }

  return {
    id: payload.id,
    discordId: payload.discordId,
    username: payload.username,
    memberships: payload.memberships,
  };
}
