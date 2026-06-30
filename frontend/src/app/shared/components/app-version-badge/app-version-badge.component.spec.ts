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
            getConfig: () => ({ apiBuildVersion: '1.1.9', apiVersion: '1.1.9' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppVersionBadgeComponent);
    fixture.detectChanges();
  });

  it('exibe frontend e build da API no formato v1.x - v1.y', () => {
    const badge: HTMLElement = fixture.nativeElement.querySelector('p');
    expect(badge).not.toBeNull();
    expect(badge.textContent?.trim()).toBe(`v${APP_VERSION} - v1.1.9`);
    expect(badge.className).toContain('text-[10px]');
    expect(badge.getAttribute('aria-label')).toBe(`Frontend v${APP_VERSION}, API build v1.1.9`);
  });
});
