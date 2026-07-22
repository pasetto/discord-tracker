import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Membership retornada após autenticação.
 */
export interface AuthMembershipDto {
  organizationId: string;
  role: string;
  status?: 'active' | 'pending';
}

/**
 * Organização vinculada ao usuário autenticado.
 */
export interface AuthOrganizationOptionDto {
  id: string;
  name: string;
  slug: string;
  role: string;
  status: 'active' | 'pending';
}

/**
 * Usuário autenticado retornado pela API.
 */
export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string;
  isSuperAdmin?: boolean;
  memberships: AuthMembershipDto[];
}

/**
 * Organização principal retornada no login/cadastro.
 */
export interface AuthOrganizationDto {
  id: string;
  name: string;
  slug: string;
}

/**
 * Resposta de login ou cadastro.
 */
export interface AuthSessionResponse {
  accessToken: string;
  user: AuthUserDto;
  organization: AuthOrganizationDto | null;
  organizations?: AuthOrganizationOptionDto[];
}

/**
 * Payload de cadastro de conta.
 */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  /** Obrigatório quando `inviteCode` não é informado. */
  organizationName?: string;
  /** Código de convite para entrar em organização existente (membership pendente). */
  inviteCode?: string;
}

/**
 * Payload de login.
 */
export interface LoginRequest {
  email: string;
  password: string;
  /** Quando `false`, sessão expira ao fechar o navegador (cookie + storage de sessão). */
  rememberMe?: boolean;
}

/**
 * Cliente HTTP para autenticação email/senha.
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly authRequestOptions = { withCredentials: true };

  constructor(private readonly http: HttpClient) {}

  /**
   * Cadastra nova conta na plataforma.
   * @param payload Dados de registro
   * @returns Sessão autenticada criada
   */
  register(payload: RegisterRequest): Observable<AuthSessionResponse> {
    return this.http.post<AuthSessionResponse>('/api/v1/auth/register', payload, this.authRequestOptions);
  }

  /**
   * Autentica usuário existente.
   * @param payload Credenciais
   * @returns Sessão autenticada
   */
  login(payload: LoginRequest): Observable<AuthSessionResponse> {
    return this.http.post<AuthSessionResponse>('/api/v1/auth/login', payload, this.authRequestOptions);
  }

  /**
   * Renova access token usando cookie HttpOnly de refresh.
   * @returns Nova sessão com access token atualizado
   */
  refresh(): Observable<AuthSessionResponse> {
    return this.http.post<AuthSessionResponse>('/api/v1/auth/refresh', {}, this.authRequestOptions);
  }

  /**
   * Retorna sessão atual com organizações vinculadas.
   * @returns Dados do usuário e organizações
   */
  getSession(): Observable<Omit<AuthSessionResponse, 'accessToken'>> {
    return this.http.get<Omit<AuthSessionResponse, 'accessToken'>>('/api/v1/auth/me', this.authRequestOptions);
  }

  /**
   * Solicita entrada em organização via código de convite.
   * @param inviteCode Código de 8 caracteres
   * @returns Sessão atualizada
   */
  joinOrganization(inviteCode: string): Observable<AuthSessionResponse> {
    return this.http.post<AuthSessionResponse>(
      '/api/v1/auth/join-organization',
      { inviteCode },
      this.authRequestOptions,
    );
  }

  /**
   * Define organização ativa no cliente.
   * @param organizationId ID da organização
   * @returns Sessão com organização ativa
   */
  switchOrganization(organizationId: string): Observable<AuthSessionResponse> {
    return this.http.post<AuthSessionResponse>(
      '/api/v1/auth/switch-organization',
      { organizationId },
      this.authRequestOptions,
    );
  }

  /**
   * Encerra sessão no servidor removendo cookie de refresh.
   * @returns Observable vazio (204)
   */
  logout(): Observable<void> {
    return this.http.post<void>('/api/v1/auth/logout', {}, this.authRequestOptions);
  }

  /**
   * Solicita email de redefinição de senha (resposta sempre genérica).
   * @param email Email informado
   */
  forgotPassword(email: string): Observable<{ ok: true; message?: string }> {
    return this.http.post<{ ok: true; message?: string }>(
      '/api/v1/auth/forgot-password',
      { email },
      this.authRequestOptions,
    );
  }

  /**
   * Conclui redefinição de senha com token do email/link.
   * @param payload Token + nova senha
   */
  resetPassword(payload: { token: string; newPassword: string }): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>('/api/v1/auth/reset-password', payload, this.authRequestOptions);
  }
}
