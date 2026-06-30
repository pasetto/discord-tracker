import { ComponentFixture, TestBed } from '@angular/core/testing';
import { APP_VERSION } from '../../../core/version/app-version';
import { PublicConfigService } from '../../../core/api/public-config.service';
import { AppVersionBadgeComponent } from './app-version-badge.component';

describe('AppVersionBadgeComponent', () => {
  let fixture: ComponentFixture<AppVersionBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppVersionBadgeComponent],
      providers: [
        {
          provide: PublicConfigService,
          useValue: {
            getConfig: () => ({ apiVersion: '1.2.0' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppVersionBadgeComponent);
    fixture.detectChanges();
  });

  it('exibe versões do frontend e da API de forma discreta', () => {
    const badge: HTMLElement = fixture.nativeElement.querySelector('p');
    expect(badge).not.toBeNull();
    expect(badge.textContent?.trim()).toBe(`v${APP_VERSION} · API v1.2.0`);
    expect(badge.className).toContain('text-[10px]');
    expect(badge.getAttribute('aria-label')).toBe(`Frontend v${APP_VERSION}, API v1.2.0`);
  });
});
