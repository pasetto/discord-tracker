import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

/** Plano do catálogo (painel admin). */
export interface AdminPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  currency: 'BRL';
  billingInterval: 'month' | 'year';
  limits: {
    maxGuilds: number;
    maxTrackedMembers: number;
    dataRetentionDays: number;
  };
  features: Record<string, boolean>;
  stripeProductId?: string;
  stripePriceId?: string;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  trialDays: number;
}

/** Usuário da plataforma (listagem admin). */
export interface AdminPlatformUser {
  id: string;
  email: string;
  displayName: string;
  discordId?: string;
  isSuperAdmin: boolean;
  membershipsCount: number;
  createdAt: string;
}

/** Organização tenant (listagem admin). */
export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  planName: string;
  planSlug: string;
  subscriptionStatus: string;
  createdAt: string;
}

/**
 * Cliente HTTP para APIs `/api/v1/admin/*` (super admin).
 */
@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly baseUrl = '/api/v1/admin';

  constructor(private readonly http: HttpClient) {}

  /**
   * Lista planos do catálogo.
   * @returns Observable com array de planos
   */
  listPlans(): Observable<AdminPlan[]> {
    return this.http.get<{ plans: AdminPlan[] }>(`${this.baseUrl}/plans`).pipe(map((body) => body.plans));
  }

  /**
   * Cria novo plano.
   * @param payload Dados do plano
   */
  createPlan(payload: Omit<AdminPlan, 'id' | 'currency'>): Observable<AdminPlan> {
    return this.http.post<{ plan: AdminPlan }>(`${this.baseUrl}/plans`, payload).pipe(map((body) => body.plan));
  }

  /**
   * Atualiza plano existente.
   * @param planId ID do plano
   * @param payload Campos a atualizar
   */
  updatePlan(planId: string, payload: Partial<Omit<AdminPlan, 'id' | 'currency'>>): Observable<AdminPlan> {
    return this.http
      .patch<{ plan: AdminPlan }>(`${this.baseUrl}/plans/${planId}`, payload)
      .pipe(map((body) => body.plan));
  }

  /**
   * Lista usuários da plataforma.
   * @param limit Limite de registros
   * @param skip Offset
   */
  listUsers(limit = 50, skip = 0): Observable<{ users: AdminPlatformUser[]; total: number }> {
    const params = new HttpParams().set('limit', limit).set('skip', skip);
    return this.http.get<{ users: AdminPlatformUser[]; total: number }>(`${this.baseUrl}/users`, { params });
  }

  /**
   * Atualiza usuário (ex.: promover super admin).
   * @param userId ID do usuário
   * @param payload Campos editáveis
   */
  updateUser(userId: string, payload: { isSuperAdmin?: boolean; displayName?: string }): Observable<AdminPlatformUser> {
    return this.http
      .patch<{ user: AdminPlatformUser }>(`${this.baseUrl}/users/${userId}`, payload)
      .pipe(map((body) => body.user));
  }

  /**
   * Lista organizações (tenants).
   * @param limit Limite de registros
   * @param skip Offset
   */
  listOrganizations(limit = 50, skip = 0): Observable<{ organizations: AdminOrganization[]; total: number }> {
    const params = new HttpParams().set('limit', limit).set('skip', skip);
    return this.http.get<{ organizations: AdminOrganization[]; total: number }>(`${this.baseUrl}/organizations`, {
      params,
    });
  }
}
