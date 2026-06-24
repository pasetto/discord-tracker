import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { TenantContextService } from '../tenant/tenant-context.service';

/**
 * Membro rastreado disponível para seleção em formulários.
 */
export interface TrackedMemberOption {
  id: string;
  discordId: string;
  displayName: string;
  username: string;
  categoryId?: string;
}

/**
 * Carrega e sincroniza membros rastreados do servidor Discord monitorado.
 */
@Injectable({ providedIn: 'root' })
export class TrackedMembersService {
  constructor(
    private readonly http: HttpClient,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Lista membros rastreados do guild ativo.
   * @returns Observable com opções ordenadas por nome
   */
  listMembers(): Observable<TrackedMemberOption[]> {
    return this.http
      .get<{ members: TrackedMemberOption[] }>(`${this.tenantContext.getGuildApiBaseUrl()}/tracked-users`)
      .pipe(map((response) => response.members ?? []));
  }

  /**
   * Sincroniza membros humanos do Discord para o banco de rastreamento.
   * @returns Observable com contagem sincronizada e membros atualizados
   */
  syncMembers(): Observable<{ syncedCount: number; members: TrackedMemberOption[] }> {
    return this.http.post<{ syncedCount: number; members: TrackedMemberOption[] }>(
      `${this.tenantContext.getGuildApiBaseUrl()}/tracked-users/sync`,
      {},
    );
  }

  /**
   * Atribui categorias em lote aos membros rastreados.
   * @param assignments Lista de vínculos membro → categoria
   * @returns Observable com membros atualizados
   */
  assignCategories(
    assignments: Array<{ trackedUserId: string; categoryId: string | null }>,
  ): Observable<{ members: TrackedMemberOption[] }> {
    return this.http.put<{ members: TrackedMemberOption[] }>(
      `${this.tenantContext.getGuildApiBaseUrl()}/tracked-users/category-assignments`,
      { assignments },
    );
  }
}
