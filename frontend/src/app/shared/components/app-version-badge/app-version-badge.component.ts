import { Component, inject } from '@angular/core';
import { APP_VERSION } from '../../../core/version/app-version';
import { PublicConfigService } from '../../../core/api/public-config.service';

/**
 * Exibe versão do frontend e build da API no formato `v1.x - v1.y`.
 */
@Component({
  selector: 'app-version-badge',
  standalone: true,
  templateUrl: './app-version-badge.component.html',
})
export class AppVersionBadgeComponent {
  private readonly publicConfigService = inject(PublicConfigService);

  /**
   * Versão semver do frontend (ex.: `1.2.0`).
   */
  readonly frontendVersion = APP_VERSION;

  /**
   * Versão semver do build da API em execução, via `/public/config`.
   */
  get apiBuildVersion(): string | null {
    const config = this.publicConfigService.getConfig();
    return config?.apiBuildVersion ?? config?.apiVersion ?? null;
  }

  /**
   * Rótulo acessível com ambas as versões quando a API estiver disponível.
   */
  get ariaLabel(): string {
    if (this.apiBuildVersion) {
      return `Frontend v${this.frontendVersion}, API build v${this.apiBuildVersion}`;
    }
    return `Frontend v${this.frontendVersion}`;
  }
}
