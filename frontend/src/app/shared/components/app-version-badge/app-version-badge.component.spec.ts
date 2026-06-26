import { ComponentFixture, TestBed } from '@angular/core/testing';
import { APP_VERSION } from '../../../core/version/app-version';
import { AppVersionBadgeComponent } from './app-version-badge.component';

describe('AppVersionBadgeComponent', () => {
  let fixture: ComponentFixture<AppVersionBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppVersionBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AppVersionBadgeComponent);
    fixture.detectChanges();
  });

  it('exibe versão do package.json de forma discreta', () => {
    const badge: HTMLElement = fixture.nativeElement.querySelector('p');
    expect(badge).not.toBeNull();
    expect(badge.textContent?.trim()).toBe(`v${APP_VERSION}`);
    expect(badge.className).toContain('text-[10px]');
    expect(badge.getAttribute('aria-label')).toBe(`Versão ${APP_VERSION}`);
  });
});
