/**
 * Dados do usuário autenticado persistidos no navegador.
 */
export interface AuthUserSession {
  id: string;
  email: string;
  displayName: string;
}

/**
 * Dados da organização ativa persistidos no navegador.
 */
export interface AuthOrganizationSession {
  id: string;
  name: string;
  slug: string;
}
