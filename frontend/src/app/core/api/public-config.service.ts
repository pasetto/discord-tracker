import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

/**
 * Configuração pública consumida pelo frontend no bootstrap.
 */
export interface PublicApiConfig {
  /**
   * Nome da aplicação exibido no frontend.
   */
  appName?: string;
  /**
   * URL base da API para chamadas autenticadas.
   */
  apiBaseUrl?: string;
  /**
   * Modo de autenticação suportado pelo backend.
   */
  authMode?: 'email_password';
  /**
   * Indica se o aplicativo Discord já foi cadastrado no backend.
   */
  botConfigured?: boolean;
  /**
   * Client ID público do aplicativo Discord.
   */
  discordClientId?: string | null;
}

/**
 * Lê e mantém em memória a configuração pública da aplicação.
 */
@Injectable({ providedIn: 'root' })
export class PublicConfigService {
  private config: PublicApiConfig | null = null;

  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Carrega a configuração pública a partir da API.
   * @param {string} endpoint Endpoint relativo de configuração pública.
   * @returns {Observable<PublicApiConfig>} Configuração carregada da API.
   * @example
   * this.publicConfigService.loadConfig().subscribe();
   */
  loadConfig(endpoint = '/api/v1/public/config'): Observable<PublicApiConfig> {
    return this.httpClient
      .get<PublicApiConfig>(endpoint)
      .pipe(tap((config) => (this.config = config)));
  }

  /**
   * Retorna a configuração pública em memória.
   * @returns {PublicApiConfig | null} Configuração atual, quando carregada.
   */
  getConfig(): PublicApiConfig | null {
    return this.config;
  }
}
