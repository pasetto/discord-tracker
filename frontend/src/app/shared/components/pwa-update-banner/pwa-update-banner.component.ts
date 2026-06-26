import { AsyncPipe } from '@angular/common';
import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { PwaUpdateService } from '../../../core/pwa/pwa-update.service';

/**
 * Banner fixo que avisa quando uma nova versão do PWA está disponível.
 */
@Component({
  selector: 'app-pwa-update-banner',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './pwa-update-banner.component.html',
})
export class PwaUpdateBannerComponent {
  /**
   * Indica se o botão de atualização está em andamento.
   */
  applying = false;

  /**
   * Stream que controla a visibilidade do banner.
   */
  readonly updateAvailable$: Observable<boolean>;

  constructor(private readonly pwaUpdateService: PwaUpdateService) {
    this.updateAvailable$ = this.pwaUpdateService.updateAvailable$;
  }

  /**
   * Ativa a nova versão e recarrega a aplicação.
   * @returns {Promise<void>} Não retorna valor útil após o reload.
   */
  async applyUpdate(): Promise<void> {
    if (this.applying) {
      return;
    }

    this.applying = true;
    try {
      await this.pwaUpdateService.applyUpdate();
    } finally {
      this.applying = false;
    }
  }
}
