import { Injectable } from '@angular/core';
import { PublicConfigService } from '../api/public-config.service';

const AUTH_TOKEN_STORAGE_KEY = 'syntra.auth.token';

/**
 * Encapsula operações de autenticação do frontend.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private readonly publicConfigService: PublicConfigService) {}

  /**
   * Salva o token de autenticação no armazenamento local.
   * @param {string} token Token JWT/sessão retornado pelo backend.
   * @returns {void} Não retorna valor.
   */
  saveToken(token: string): void {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  }

  /**
   * Recupera o token salvo no armazenamento local.
   * @returns {string | null} Token salvo ou `null` quando ausente.
   */
  getToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  }

  /**
   * Remove o token atual do armazenamento local.
   * @returns {void} Não retorna valor.
   */
  clearToken(): void {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }

  /**
   * Verifica se existe token de autenticação válido em memória local.
   * @returns {boolean} `true` quando há token não vazio, senão `false`.
   */
  hasToken(): boolean {
    const token = this.getToken();
    return Boolean(token?.trim());
  }

  /**
   * Inicia o fluxo OAuth redirecionando para o endpoint do Discord.
   * @returns {void} Não retorna valor.
   */
  redirectToDiscordOAuth(): void {
    const oauthPath = this.publicConfigService.getDiscordAuthPath();
    window.location.assign(oauthPath);
  }
}
