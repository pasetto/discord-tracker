import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { PwaUpdateService } from '../../../core/pwa/pwa-update.service';
import { PwaUpdateBannerComponent } from './pwa-update-banner.component';

describe('PwaUpdateBannerComponent', () => {
  let fixture: ComponentFixture<PwaUpdateBannerComponent>;
  let updateAvailable$: BehaviorSubject<boolean>;
  let applyUpdateSpy: jasmine.Spy;

  beforeEach(async () => {
    updateAvailable$ = new BehaviorSubject<boolean>(false);
    applyUpdateSpy = jasmine.createSpy('applyUpdate').and.returnValue(Promise.resolve());

    await TestBed.configureTestingModule({
      imports: [PwaUpdateBannerComponent],
      providers: [
        {
          provide: PwaUpdateService,
          useValue: {
            updateAvailable$: updateAvailable$.asObservable(),
            applyUpdate: applyUpdateSpy,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PwaUpdateBannerComponent);
    fixture.detectChanges();
  });

  it('oculta banner quando não há atualização', () => {
    const banner = fixture.nativeElement.querySelector('[role="status"]');
    expect(banner).toBeNull();
  });

  it('exibe banner e aciona atualização ao clicar', async () => {
    updateAvailable$.next(true);
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('[role="status"]');
    expect(banner).not.toBeNull();
    expect(banner.textContent).toContain('Nova versão disponível');

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    button.click();
    await fixture.whenStable();

    expect(applyUpdateSpy).toHaveBeenCalled();
  });
});
