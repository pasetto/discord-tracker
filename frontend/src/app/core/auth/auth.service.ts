import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { AuthApiService, type AuthSessionResponse, type LoginRequest, type RegisterRequest } from './auth-api.service';

const AUTH_TOKEN_STORAGE_KEY = 'syntra.auth.token';
const ORG_ID_STORAGE_KEY = 'syntra.orgId';

/**
 * Encapsula operações de autenticação do frontend.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private readonly authApiService: AuthApiService) {}

  /**
   * Salva o token de autenticação no armazenamento local.
   * @param token Token JWT retornado pelo backend
   */
  saveToken(token: string): void {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  }

  /**
   * Recupera o token salvo no armazenamento local.
   * @returns Token salvo ou `null` quando ausente
   */
  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  }

  /**
   * Remove o token atual do armazenamento local.
   */
  clearToken(): void {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(ORG_ID_STORAGE_KEY);
  }

  /**
   * Verifica se existe token de autenticação válido em memória local.
   * @returns `true` quando há token não vazio
   */
  hasToken(): boolean {
    const token = this.getToken();
    return Boolean(token?.trim());
  }

  /**
   * Persiste contexto de sessão retornado pela API.
   * @param session Resposta de login/cadastro
   */
  persistSession(session: AuthSessionResponse): void {
    this.saveToken(session.accessToken);
    localStorage.setItem(ORG_ID_STORAGE_KEY, session.organization.id);
  }

  /**
   * Realiza login com email e senha.
   * @param payload Credenciais do usuário
   * @returns Observable da sessão autenticada
   */
  login(payload: LoginRequest): Observable<AuthSessionResponse> {
    return this.authApiService.login(payload).pipe(tap((session) => this.persistSession(session)));
  }

  /**
   * Realiza cadastro de nova conta.
   * @param payload Dados de registro
   * @returns Observable da sessão autenticada
   */
  register(payload: RegisterRequest): Observable<AuthSessionResponse> {
    return this.authApiService.register(payload).pipe(tap((session) => this.persistSession(session)));
  }
}
