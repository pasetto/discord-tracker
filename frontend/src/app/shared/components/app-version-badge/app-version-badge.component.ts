import { Component } from '@angular/core';
import { APP_VERSION } from '../../../core/version/app-version';

/**
 * Exibe a versão do frontend de forma discreta no canto inferior da tela.
 */
@Component({
  selector: 'app-version-badge',
  standalone: true,
  templateUrl: './app-version-badge.component.html',
})
export class AppVersionBadgeComponent {
  /**
   * Versão atual da aplicação (ex.: `1.1.1`).
   */
  readonly version = APP_VERSION;
}
