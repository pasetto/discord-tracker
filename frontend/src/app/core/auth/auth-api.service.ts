import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Membership retornada após autenticação.
 */
export interface AuthMembershipDto {
  organizationId: string;
  role: string;
}

/**
 * Usuário autenticado retornado pela API.
 */
export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string;
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
  organization: AuthOrganizationDto;
}

/**
 * Payload de cadastro de conta.
 */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  organizationName: string;
}

/**
 * Payload de login.
 */
export interface LoginRequest {
  email: string;
  password: string;
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
}
