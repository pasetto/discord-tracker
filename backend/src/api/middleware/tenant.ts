import { Context, Next } from 'koa';

/**
 * Membership de uma organização dentro do payload JWT.
 */
interface JwtMembership {
  organizationId: string;
  role: string;
}

/**
 * Usuário autenticado no payload JWT (shape inicial/stub).
 */
interface JwtUser {
  memberships: JwtMembership[];
}

/**
 * Cria erro HTTP simples com status embutido na mensagem.
 * @param status Código HTTP de erro
 * @param message Mensagem legível para logs e testes
 * @returns Erro com status e mensagem padronizada
 */
function createHttpError(status: number, message: string): Error {
  return new Error(`${status} ${message}`);
}

/**
 * Extrai organizationId de params, query ou body.
 * @param ctx Contexto da requisição Koa
 * @returns organizationId encontrado ou undefined
 */
function extractOrganizationId(ctx: Context): string | undefined {
  const fromParams = ctx.params?.organizationId ?? ctx.params?.orgId;
  if (typeof fromParams === 'string' && fromParams.trim()) {
    return fromParams.trim();
  }

  const fromQuery = ctx.query.organizationId;
  if (typeof fromQuery === 'string' && fromQuery.trim()) {
    return fromQuery.trim();
  }

  const payload = ctx.request?.body as { organizationId?: unknown } | undefined;
  if (typeof payload?.organizationId === 'string' && payload.organizationId.trim()) {
    return payload.organizationId.trim();
  }

  return undefined;
}

/**
 * Garante que o usuário autenticado pertence à organização informada.
 * @param user Usuário obtido do JWT com memberships
 * @param organizationId Organização alvo da requisição
 * @returns {void} Não retorna valor
 * @throws {Error} 403 quando usuário não pertence à organização
 * @example
 * assertOrgMembership(
 *   { memberships: [{ organizationId: 'org-a', role: 'admin' }] },
 *   'org-a',
 * );
 */
export function assertOrgMembership(user: JwtUser, organizationId: string): void {
  const hasMembership = user.memberships.some(
    (membership) => membership.organizationId === organizationId,
  );

  if (!hasMembership) {
    throw createHttpError(403, 'Forbidden: user is not member of this organization');
  }
}

/**
 * Injeta organizationId validado em ctx.state para isolamento multitenant.
 * @param ctx Contexto da requisição Koa
 * @param next Próximo middleware da cadeia
 * @returns {Promise<void>} Promise resolvida após processamento
 * @throws {Error} 400 quando organizationId está ausente
 * @throws {Error} 401 quando usuário JWT não está disponível
 * @throws {Error} 403 quando usuário não pertence à organização
 */
export async function tenantMiddleware(ctx: Context, next: Next): Promise<void> {
  const organizationId = extractOrganizationId(ctx);
  if (!organizationId) {
    throw createHttpError(400, 'Bad Request: organizationId is required');
  }

  const user = ctx.state.user as JwtUser | undefined;
  if (!user || !Array.isArray(user.memberships)) {
    throw createHttpError(401, 'Unauthorized: JWT user memberships not found');
  }

  assertOrgMembership(user, organizationId);
  ctx.state.organizationId = organizationId;

  await next();
}
