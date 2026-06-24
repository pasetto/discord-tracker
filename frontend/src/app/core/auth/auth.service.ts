import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { AuthApiService, type AuthSessionResponse, type LoginRequest, type RegisterRequest } from './auth-api.service';
import type { AuthOrganizationOption, AuthOrganizationSession, AuthUserSession, MembershipRole } from './auth-session.model';
import { TenantContextService } from '../tenant/tenant-context.service';

const AUTH_TOKEN_STORAGE_KEY = 'syntra.auth.token';
const ORG_ID_STORAGE_KEY = 'syntra.orgId';
const USER_SESSION_STORAGE_KEY = 'syntra.auth.user';
const ORG_SESSION_STORAGE_KEY = 'syntra.auth.organization';
const ORGANIZATIONS_STORAGE_KEY = 'syntra.auth.organizations';

/**
 * Shape mínimo do payload JWT necessário para resolver role atual.
 */
interface MembershipRoleTokenPayload {
  memberships?: Array<{
    organizationId?: string;
    role?: string;
  }>;
}

const MEMBERSHIP_ROLES: MembershipRole[] = ['owner', 'admin', 'manager', 'viewer'];

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
    localStorage.removeItem(ORGANIZATIONS_STORAGE_KEY);
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
   * Lista organizações vinculadas ao usuário autenticado.
   * @returns Organizações ativas e pendentes
   */
  getOrganizations(): AuthOrganizationOption[] {
    const raw = localStorage.getItem(ORGANIZATIONS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    try {
      return JSON.parse(raw) as AuthOrganizationOption[];
    } catch {
      return [];
    }
  }

  /**
   * Organizações ativas disponíveis para troca rápida.
   * @returns Apenas organizações aprovadas
   */
  getActiveOrganizations(): AuthOrganizationOption[] {
    return this.getOrganizations().filter((organization) => organization.status === 'active');
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
   * Indica se o usuário autenticado é super admin da plataforma.
   * @returns `true` quando `isSuperAdmin` está na sessão local
   */
  isSuperAdmin(): boolean {
    return Boolean(this.getUser()?.isSuperAdmin);
  }

  /**
   * Retorna o papel da membership na organização ativa da sessão.
   * @returns Papel atual (`owner|admin|manager|viewer`) ou `null` quando indisponível
   */
  getMembershipRole(): MembershipRole | null {
    const organizationId = this.getOrganizationId();
    if (!organizationId) {
      return null;
    }

    const roleFromOrganizations = this.getOrganizations().find(
      (organization) => organization.id === organizationId && organization.status === 'active',
    )?.role;
    const normalizedRoleFromOrganizations = this.normalizeMembershipRole(roleFromOrganizations);
    if (normalizedRoleFromOrganizations) {
      return normalizedRoleFromOrganizations;
    }

    const token = this.getToken();
    if (!token?.trim()) {
      return null;
    }

    try {
      const payloadSegment = token.split('.')[1];
      if (!payloadSegment) {
        return null;
      }

      const payload = JSON.parse(atob(payloadSegment)) as MembershipRoleTokenPayload;
      const roleFromToken = payload.memberships?.find((membership) => membership.organizationId === organizationId)?.role;
      return this.normalizeMembershipRole(roleFromToken);
    } catch {
      return null;
    }
  }

  /**
   * Normaliza papel textual para o conjunto conhecido de memberships.
   * @param role Papel bruto recebido da sessão/token
   * @returns Papel válido normalizado ou `null` quando inválido
   */
  private normalizeMembershipRole(role: string | undefined): MembershipRole | null {
    if (!role) {
      return null;
    }

    const normalizedRole = role.toLowerCase() as MembershipRole;
    return MEMBERSHIP_ROLES.includes(normalizedRole) ? normalizedRole : null;
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
    localStorage.setItem(
      USER_SESSION_STORAGE_KEY,
      JSON.stringify({
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        isSuperAdmin: Boolean(session.user.isSuperAdmin),
      } satisfies AuthUserSession),
    );

    if (session.organization) {
      localStorage.setItem(ORG_ID_STORAGE_KEY, session.organization.id);
      localStorage.setItem(
        ORG_SESSION_STORAGE_KEY,
        JSON.stringify({
          id: session.organization.id,
          name: session.organization.name,
          slug: session.organization.slug,
        } satisfies AuthOrganizationSession),
      );
      void this.tenantContextService.refresh().subscribe();
    } else {
      localStorage.removeItem(ORG_ID_STORAGE_KEY);
      localStorage.removeItem(ORG_SESSION_STORAGE_KEY);
      this.tenantContextService.clear();
    }

    if (session.organizations) {
      localStorage.setItem(ORGANIZATIONS_STORAGE_KEY, JSON.stringify(session.organizations));
    }
  }

  /**
   * Troca organização ativa e recarrega contexto do tenant.
   * @param organizationId ID da organização aprovada
   * @returns Observable da sessão atualizada
   */
  switchOrganization(organizationId: string): Observable<AuthSessionResponse> {
    return this.authApiService.switchOrganization(organizationId).pipe(
      tap((session) => {
        this.persistSession(session);
      }),
    );
  }

  /**
   * Solicita entrada em organização via código de convite.
   * @param inviteCode Código de 8 caracteres
   * @returns Observable da sessão atualizada
   */
  joinOrganization(inviteCode: string): Observable<AuthSessionResponse> {
    return this.authApiService.joinOrganization(inviteCode).pipe(
      tap((session) => {
        this.persistSession(session);
      }),
    );
  }

  /**
   * Sincroniza organizações vinculadas com a API.
   * @returns Observable da sessão sem novo access token
   */
  syncSession(): Observable<void> {
    return this.authApiService.getSession().pipe(
      tap((session) => {
        if (session.organization) {
          localStorage.setItem(ORG_ID_STORAGE_KEY, session.organization.id);
          localStorage.setItem(ORG_SESSION_STORAGE_KEY, JSON.stringify(session.organization));
        }
        if (session.organizations) {
          localStorage.setItem(ORGANIZATIONS_STORAGE_KEY, JSON.stringify(session.organizations));
        }
      }),
      map(() => undefined),
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
