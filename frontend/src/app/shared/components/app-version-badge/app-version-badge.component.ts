import { Component, inject } from '@angular/core';
import { APP_VERSION } from '../../../core/version/app-version';
import { PublicConfigService } from '../../../core/api/public-config.service';

/**
 * Exibe as versões do frontend e da API de forma discreta no canto inferior da tela.
 */
@Component({
  selector: 'app-version-badge',
  standalone: true,
  templateUrl: './app-version-badge.component.html',
})
export class AppVersionBadgeComponent {
  private readonly publicConfigService = inject(PublicConfigService);

  /**
   * Versão atual do frontend (ex.: `1.2.0`).
   */
  readonly frontendVersion = APP_VERSION;

  /**
   * Versão da API em execução, carregada no bootstrap via `/public/config`.
   */
  get apiVersion(): string | null {
    return this.publicConfigService.getConfig()?.apiVersion ?? null;
  }

  /**
   * Rótulo acessível com ambas as versões quando a API estiver disponível.
   */
  get ariaLabel(): string {
    if (this.apiVersion) {
      return `Frontend v${this.frontendVersion}, API v${this.apiVersion}`;
    }
    return `Frontend v${this.frontendVersion}`;
  }
}
