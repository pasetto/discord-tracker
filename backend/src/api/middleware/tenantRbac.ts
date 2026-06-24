import Router from '@koa/router';

/**
 * Papéis suportados no RBAC por tenant.
 */
export type TenantMembershipRole = 'owner' | 'admin' | 'manager' | 'viewer';

/**
 * Membership mínima serializada no JWT para o tenant atual.
 */
interface JwtMembership {
  organizationId: string;
  role: string;
}

/**
 * Shape mínimo de usuário autenticado no `ctx.state`.
 */
interface JwtUserShape {
  memberships?: JwtMembership[];
}

const VIEWER_ROLES = new Set<TenantMembershipRole>(['owner', 'admin', 'manager', 'viewer']);
const MANAGER_ROLES = new Set<TenantMembershipRole>(['owner', 'admin', 'manager']);

/**
 * Normaliza role textual para o conjunto conhecido de papéis do tenant.
 * @param role Papel recebido do JWT
 * @returns Papel válido normalizado ou `undefined` quando inválido/ausente
 */
function normalizeMembershipRole(role: string | undefined): TenantMembershipRole | undefined {
  if (!role) {
    return undefined;
  }

  const normalized = role.toLowerCase();
  if (normalized === 'owner' || normalized === 'admin' || normalized === 'manager' || normalized === 'viewer') {
    return normalized;
  }

  return undefined;
}

/**
 * Retorna o papel de membership do usuário autenticado para uma organização.
 * @param {Router.RouterContext} ctx Contexto Koa da requisição
 * @param {string} organizationId Identificador da organização no tenant
 * @returns {TenantMembershipRole | undefined} Papel normalizado quando encontrado
 * @example
 * getMembershipRole(ctx, '665f9312eb6f3a663b6f0001');
 */
export function getMembershipRole(
  ctx: Router.RouterContext,
  organizationId: string,
): TenantMembershipRole | undefined {
  const user = ctx.state.user as JwtUserShape | undefined;
  const membership = user?.memberships?.find((item) => item.organizationId === organizationId);
  return normalizeMembershipRole(membership?.role);
}

/**
 * Garante que o usuário tenha permissão de leitura no tenant (inclui viewer).
 * @param {Router.RouterContext} ctx Contexto Koa da requisição
 * @param {string} organizationId Identificador da organização no tenant
 * @returns {void} Não retorna valor
 * @throws {Error} Lança 403 quando o usuário não pode visualizar o recurso
 */
export function assertViewerReadRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !VIEWER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para visualizar este recurso');
  }
}

/**
 * Garante que o usuário tenha permissão de gestão no tenant.
 * @param {Router.RouterContext} ctx Contexto Koa da requisição
 * @param {string} organizationId Identificador da organização no tenant
 * @returns {void} Não retorna valor
 * @throws {Error} Lança 403 quando o usuário não pode alterar o recurso
 */
export function assertManagerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !MANAGER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para gerenciar este recurso');
  }
}
