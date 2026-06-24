/**
 * Papéis suportados na membership de organização.
 */
export type MembershipRole = 'owner' | 'admin' | 'manager' | 'viewer';

/**
 * Dados do usuário autenticado persistidos no navegador.
 */
export interface AuthUserSession {
  id: string;
  email: string;
  displayName: string;
  isSuperAdmin?: boolean;
}

/**
 * Dados da organização ativa persistidos no navegador.
 */
export interface AuthOrganizationSession {
  id: string;
  name: string;
  slug: string;
}

/**
 * Organização disponível para troca no seletor.
 */
export interface AuthOrganizationOption {
  id: string;
  name: string;
  slug: string;
  role: MembershipRole;
  status: 'active' | 'pending';
}
