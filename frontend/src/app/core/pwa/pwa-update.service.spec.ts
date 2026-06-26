import { ApplicationRef } from '@angular/core';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Observable, Subject, of } from 'rxjs';
import { PwaUpdateService } from './pwa-update.service';

describe('PwaUpdateService', () => {
  let versionUpdates$: Subject<VersionEvent>;
  let swUpdateMock: {
    isEnabled: boolean;
    versionUpdates: Observable<VersionEvent>;
    checkForUpdate: jasmine.Spy<() => Promise<boolean>>;
    activateUpdate: jasmine.Spy<() => Promise<boolean>>;
  };
  let isStable$: Subject<boolean>;
  let reloadSpy: jasmine.Spy;
  let documentMock: Document;

  /**
   * Cria instância do serviço com mocks explícitos, evitando DI pesada do Angular nos testes.
   * @returns Instância configurada de {@link PwaUpdateService}
   */
  function createService(): PwaUpdateService {
    return new PwaUpdateService(
      swUpdateMock as unknown as SwUpdate,
      { isStable: isStable$.asObservable() } as ApplicationRef,
      documentMock,
    );
  }

  beforeEach(() => {
    reloadSpy = jasmine.createSpy('reload');
    documentMock = {
      location: { reload: reloadSpy },
    } as unknown as Document;
    versionUpdates$ = new Subject<VersionEvent>();
    isStable$ = new Subject<boolean>();
    swUpdateMock = {
      isEnabled: true,
      versionUpdates: versionUpdates$.asObservable(),
      checkForUpdate: jasmine.createSpy('checkForUpdate').and.returnValue(Promise.resolve(true)),
      activateUpdate: jasmine.createSpy('activateUpdate').and.returnValue(Promise.resolve(true)),
    };
  });

  it('ignora escuta quando service worker está desabilitado', () => {
    swUpdateMock.isEnabled = false;
    const service = createService();

    let updateAvailable = false;
    service.updateAvailable$.subscribe((value) => {
      updateAvailable = value;
    });

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });

    expect(updateAvailable).toBeFalse();
  });

  it('sinaliza nova versão ao receber VERSION_READY', () => {
    const service = createService();

    let updateAvailable = false;
    service.updateAvailable$.subscribe((value) => {
      updateAvailable = value;
    });

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });

    expect(updateAvailable).toBeTrue();
  });

  it('ativa update e recarrega a página', async () => {
    const service = createService();

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
    });

    await service.applyUpdate();

    expect(swUpdateMock.activateUpdate).toHaveBeenCalled();
    expect(reloadSpy).toHaveBeenCalled();
  });

  it('verifica atualizações quando a aplicação estabiliza', () => {
    createService();
    isStable$.next(true);

    expect(swUpdateMock.checkForUpdate).toHaveBeenCalled();
  });

  it('não aplica update quando nenhuma versão está disponível', async () => {
    const service = createService();

    await service.applyUpdate();

    expect(swUpdateMock.activateUpdate).not.toHaveBeenCalled();
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('ignora checkForUpdate quando service worker está desabilitado', () => {
    swUpdateMock.isEnabled = false;
    createService();
    isStable$.next(true);

    expect(swUpdateMock.checkForUpdate).not.toHaveBeenCalled();
  });

  it('continua funcionando com app já estável no bootstrap', () => {
    const stableAppRef = { isStable: of(true) } as ApplicationRef;
    new PwaUpdateService(swUpdateMock as unknown as SwUpdate, stableAppRef, documentMock);

    expect(swUpdateMock.checkForUpdate).toHaveBeenCalled();
  });
});
