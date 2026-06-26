import { DOCUMENT } from '@angular/common';
import { ApplicationRef, Inject, Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { BehaviorSubject, filter, first, interval, merge, Observable, of, switchMap } from 'rxjs';

/** Intervalo entre verificações automáticas de nova versão (6 horas). */
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Gerencia detecção e ativação de novas versões do PWA via Angular Service Worker.
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly updateAvailableSubject = new BehaviorSubject<boolean>(false);

  /**
   * Emite `true` quando há uma nova versão pronta para ativação.
   */
  readonly updateAvailable$: Observable<boolean> = this.updateAvailableSubject.asObservable();

  constructor(
    private readonly swUpdate: SwUpdate,
    private readonly appRef: ApplicationRef,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {
    if (!this.swUpdate.isEnabled) {
      return;
    }

    this.listenForVersionReady();
    this.scheduleUpdateChecks();
  }

  /**
   * Ativa a nova versão do service worker e recarrega a página.
   * @returns Promise resolvida após solicitar reload (o navegador recarrega antes de concluir).
   */
  async applyUpdate(): Promise<void> {
    if (!this.swUpdate.isEnabled || !this.updateAvailableSubject.value) {
      return;
    }

    await this.swUpdate.activateUpdate();
    this.document.location.reload();
  }

  /**
   * Escuta eventos do service worker indicando versão pronta para uso.
   * @returns {void} Não retorna valor.
   */
  private listenForVersionReady(): void {
    this.swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => {
        this.updateAvailableSubject.next(true);
      });
  }

  /**
   * Verifica atualizações após estabilização do app e periodicamente enquanto a aba estiver aberta.
   * @returns {void} Não retorna valor.
   */
  private scheduleUpdateChecks(): void {
    this.appRef.isStable
      .pipe(
        filter((stable) => stable),
        first(),
        switchMap(() => merge(of(void 0), interval(UPDATE_CHECK_INTERVAL_MS))),
      )
      .subscribe(() => {
        void this.swUpdate.checkForUpdate().catch(() => undefined);
      });
  }
}
