import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { AuthApiService, type AuthSessionResponse, type LoginRequest, type RegisterRequest } from './auth-api.service';
import type { AuthOrganizationSession, AuthUserSession } from './auth-session.model';
import { TenantContextService } from '../tenant/tenant-context.service';

const AUTH_TOKEN_STORAGE_KEY = 'syntra.auth.token';
const ORG_ID_STORAGE_KEY = 'syntra.orgId';
const USER_SESSION_STORAGE_KEY = 'syntra.auth.user';
const ORG_SESSION_STORAGE_KEY = 'syntra.auth.organization';

/**
 * Encapsula operações de autenticação do frontend.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private refreshInFlight: Observable<string> | null = null;

  constructor(
    private readonly authApiService: AuthApiService,
    private readonly tenantContextService: TenantContextService,
    private readonly router: Router,
  ) {}

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
    localStorage.removeItem(USER_SESSION_STORAGE_KEY);
    localStorage.removeItem(ORG_SESSION_STORAGE_KEY);
    this.tenantContextService.clear();
  }

  /**
   * Retorna usuário autenticado salvo na sessão local.
   * @returns Dados do usuário ou null
   */
  getUser(): AuthUserSession | null {
    const raw = localStorage.getItem(USER_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthUserSession;
    } catch {
      return null;
    }
  }

  /**
   * Retorna organização ativa salva na sessão local.
   * @returns Dados da organização ou null
   */
  getOrganization(): AuthOrganizationSession | null {
    const raw = localStorage.getItem(ORG_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthOrganizationSession;
    } catch {
      return null;
    }
  }

  /**
   * Retorna ID da organização ativa.
   * @returns ID da organização ou string vazia
   */
  getOrganizationId(): string {
    return this.getOrganization()?.id ?? localStorage.getItem(ORG_ID_STORAGE_KEY) ?? '';
  }

  /**
   * Nome de exibição do usuário autenticado.
   * @returns Nome amigável ou fallback por email
   */
  getDisplayName(): string {
    const user = this.getUser();
    if (user?.displayName?.trim()) {
      return user.displayName.trim();
    }
    return user?.email?.split('@')[0] ?? 'Usuário';
  }

  /**
   * Encerra sessão local e redireciona para login.
   */
  logout(): void {
    this.clearToken();
    void this.router.navigate(['/login']);
  }

  /**
   * Verifica se existe token de autenticação válido em memória local.
   * @returns `true` quando há token não vazio e não expirado
   */
  isTokenValid(): boolean {
    const token = this.getToken();
    if (!token?.trim()) {
      return false;
    }

    try {
      const payloadSegment = token.split('.')[1];
      if (!payloadSegment) {
        return false;
      }

      const payload = JSON.parse(atob(payloadSegment)) as { exp?: number };
      if (!payload.exp) {
        return false;
      }

      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  /**
   * Renova access token usando cookie HttpOnly de refresh.
   * @returns Observable com novo JWT de acesso
   */
  refreshAccessToken(): Observable<string> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.authApiService.refresh().pipe(
        tap((session) => {
          if (!session.accessToken?.trim()) {
            throw new Error('Resposta de refresh sem access token');
          }
          this.persistSession(session);
        }),
        map((session) => session.accessToken),
        finalize(() => {
          this.refreshInFlight = null;
        }),
        shareReplay(1),
      );
    }

    return this.refreshInFlight;
  }

  /**
   * Verifica se o token expira em breve e deve ser renovado proativamente.
   * @param skewSeconds Margem em segundos antes do vencimento
   * @returns `true` quando o token está ausente, inválido ou perto de expirar
   */
  shouldRefreshToken(skewSeconds = 120): boolean {
    const token = this.getToken();
    if (!token?.trim()) {
      return false;
    }

    try {
      const payloadSegment = token.split('.')[1];
      if (!payloadSegment) {
        return true;
      }

      const payload = JSON.parse(atob(payloadSegment)) as { exp?: number };
      if (!payload.exp) {
        return true;
      }

      return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
    } catch {
      return true;
    }
  }

  /**
   * Restaura sessão ao abrir o app quando o access token expirou mas o refresh ainda é válido.
   * @returns Observable indicando se a sessão foi restaurada
   */
  tryRestoreSession(): Observable<boolean> {
    if (!this.getUser()) {
      return of(false);
    }

    if (this.isTokenValid() && !this.shouldRefreshToken()) {
      return of(true);
    }

    return this.refreshAccessToken().pipe(
      map(() => true),
      catchError(() => {
        this.clearToken();
        return of(false);
      }),
    );
  }

  /**
   * Verifica se existe token de autenticação no armazenamento local.
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
    if (!session.accessToken?.trim()) {
      return;
    }

    this.saveToken(session.accessToken);
    localStorage.setItem(ORG_ID_STORAGE_KEY, session.organization.id);
    localStorage.setItem(
      USER_SESSION_STORAGE_KEY,
      JSON.stringify({
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
      } satisfies AuthUserSession),
    );
    localStorage.setItem(
      ORG_SESSION_STORAGE_KEY,
      JSON.stringify({
        id: session.organization.id,
        name: session.organization.name,
        slug: session.organization.slug,
      } satisfies AuthOrganizationSession),
    );
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
