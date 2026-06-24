import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, tap, map } from 'rxjs';

const ORG_ID_STORAGE_KEY = 'syntra.orgId';

/** Conexão ativa com servidor Discord. */
export interface ActiveGuildConnection {
  guildId: string;
  guildName: string;
  iconUrl?: string;
  isMonitoringEnabled: boolean;
}

/** Estado do tenant carregado da API. */
export interface TenantContextState {
  orgId: string;
  guildId: string;
  guildName: string;
  botConnected: boolean;
  activeConnection: ActiveGuildConnection | null;
  loaded: boolean;
}

const GUILD_ID_STORAGE_KEY = 'syntra.guildId';
const GUILD_NAME_STORAGE_KEY = 'syntra.guildName';

/**
 * Centraliza organizationId e guildId do tenant, evitando inputs manuais nas telas.
 */
@Injectable({ providedIn: 'root' })
export class TenantContextService {
  private readonly stateSubject = new BehaviorSubject<TenantContextState>({
    orgId: '',
    guildId: '',
    guildName: '',
    botConnected: false,
    activeConnection: null,
    loaded: false,
  });

  /** Stream reativo do contexto do tenant. */
  readonly state$ = this.stateSubject.asObservable();

  constructor(private readonly http: HttpClient) {}

  /**
   * ID da organização ativa.
   */
  get orgId(): string {
    return this.stateSubject.value.orgId || localStorage.getItem(ORG_ID_STORAGE_KEY) || '';
  }

  /**
   * ID do servidor Discord monitorado.
   */
  get guildId(): string {
    return this.stateSubject.value.guildId || localStorage.getItem(GUILD_ID_STORAGE_KEY) || '';
  }

  /**
   * Nome do servidor Discord monitorado.
   */
  get guildName(): string {
    return this.stateSubject.value.guildName;
  }

  /**
   * Indica se há servidor selecionado para consultas por guild.
   */
  get hasGuild(): boolean {
    return Boolean(this.guildId);
  }

  /**
   * Carrega status Discord e sincroniza guild ativo no contexto.
   * @returns Observable do estado atualizado
   */
  refresh(): Observable<TenantContextState> {
    const orgId = localStorage.getItem(ORG_ID_STORAGE_KEY) ?? '';
    if (!orgId) {
      this.patchState({ orgId: '', loaded: true });
      return of(this.stateSubject.value);
    }

    return this.http
      .get<{ botConnected: boolean; activeConnection: ActiveGuildConnection | null }>(
        `/api/v1/org/${orgId}/discord/status`,
      )
      .pipe(
        tap((status) => {
          const guildId = status.activeConnection?.guildId ?? localStorage.getItem(GUILD_ID_STORAGE_KEY) ?? '';
          const guildName =
            status.activeConnection?.guildName ?? localStorage.getItem(GUILD_NAME_STORAGE_KEY) ?? '';

          if (guildId) {
            localStorage.setItem(GUILD_ID_STORAGE_KEY, guildId);
          }
          if (guildName) {
            localStorage.setItem(GUILD_NAME_STORAGE_KEY, guildName);
          }

          this.patchState({
            orgId,
            guildId,
            guildName,
            botConnected: status.botConnected,
            activeConnection: status.activeConnection,
            loaded: true,
          });
        }),
        map(() => this.stateSubject.value),
      );
  }

  /**
   * Atualiza guild selecionado após escolha na UI de Discord.
   * @param connection Conexão retornada pela API
   */
  setActiveGuild(connection: ActiveGuildConnection): void {
    localStorage.setItem(GUILD_ID_STORAGE_KEY, connection.guildId);
    localStorage.setItem(GUILD_NAME_STORAGE_KEY, connection.guildName);
    this.patchState({
      guildId: connection.guildId,
      guildName: connection.guildName,
      activeConnection: connection,
    });
  }

  /**
   * Monta URL base de endpoints por organização e guild.
   * @returns Prefixo `/api/v1/org/{orgId}/guilds/{guildId}`
   */
  getGuildApiBaseUrl(): string {
    return `/api/v1/org/${this.orgId}/guilds/${this.guildId}`;
  }

  /**
   * Monta URL base de endpoints somente por organização.
   * @returns Prefixo `/api/v1/org/{orgId}`
   */
  getOrgApiBaseUrl(): string {
    return `/api/v1/org/${this.orgId}`;
  }

  /**
   * Limpa contexto de guild ao sair da conta.
   */
  clear(): void {
    localStorage.removeItem(GUILD_ID_STORAGE_KEY);
    localStorage.removeItem(GUILD_NAME_STORAGE_KEY);
    this.stateSubject.next({
      orgId: '',
      guildId: '',
      guildName: '',
      botConnected: false,
      activeConnection: null,
      loaded: false,
    });
  }

  /**
   * Aplica patch parcial no estado interno.
   * @param partial Campos a atualizar
   */
  private patchState(partial: Partial<TenantContextState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}
