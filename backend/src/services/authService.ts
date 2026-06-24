import jwt, { JwtPayload } from 'jsonwebtoken';
import { config } from '../config/env';

/** Tempo de expiração do access token em segundos (padrão: 15 min prod, 8 h dev). */
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS =
  (process.env.NODE_ENV ?? 'development') === 'development' ? 8 * 60 * 60 : 15 * 60;

export const ACCESS_TOKEN_TTL_SECONDS = Number(
  process.env.JWT_ACCESS_TTL_SECONDS ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
);

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
  email: string;
  username: string;
  discordId?: string;
  memberships: AuthMembership[];
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
  if (!payload.id || !payload.email || !payload.username || !Array.isArray(payload.memberships)) {
    throw new Error('JWT inválido: payload incompleto');
  }

  return {
    id: payload.id,
    email: payload.email,
    username: payload.username,
    discordId: payload.discordId,
    memberships: payload.memberships,
  };
}
