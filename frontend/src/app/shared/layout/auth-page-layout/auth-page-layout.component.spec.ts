import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthPageLayoutComponent } from './auth-page-layout.component';

describe('AuthPageLayoutComponent', () => {
  let fixture: ComponentFixture<AuthPageLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthPageLayoutComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthPageLayoutComponent);
    fixture.detectChanges();
  });

  it('deve criar o layout de autenticação', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('deve expor logo de tema claro e escuro no cabeçalho mobile', () => {
    const light = fixture.nativeElement.querySelector(
      '[data-testid="auth-logo-light"]',
    ) as HTMLImageElement | null;
    const dark = fixture.nativeElement.querySelector(
      '[data-testid="auth-logo-dark"]',
    ) as HTMLImageElement | null;

    expect(light).withContext('logo light ausente').not.toBeNull();
    expect(dark).withContext('logo dark ausente').not.toBeNull();
    expect(light?.getAttribute('src')).toBe('/images/logo/logo.svg');
    expect(dark?.getAttribute('src')).toBe('/images/logo/logo-dark.svg');
    expect(light?.getAttribute('alt')).toBe('Syntra');
    expect(dark?.getAttribute('alt')).toBe('Syntra');
  });

  it('deve manter o painel de marca com logo escuro no desktop', () => {
    const panelLogo = fixture.nativeElement.querySelector(
      '[data-testid="auth-panel-logo"]',
    ) as HTMLImageElement | null;

    expect(panelLogo).not.toBeNull();
    expect(panelLogo?.getAttribute('src')).toBe('/images/logo/logo-dark.svg');
  });

  it('deve travar overflow horizontal na raiz do layout', () => {
    const root = fixture.nativeElement.querySelector(
      '.overflow-x-hidden',
    ) as HTMLElement | null;

    expect(root).withContext('raiz sem overflow-x-hidden').not.toBeNull();
    expect(root?.classList.contains('min-h-screen')).toBeTrue();
  });

  it('deve renderizar marca mobile distinta do painel desktop', () => {
    const mobileBrand = fixture.nativeElement.querySelector(
      '[data-testid="auth-mobile-brand"]',
    );
    const brandPanel = fixture.nativeElement.querySelector(
      '[data-testid="auth-brand-panel"]',
    );

    expect(mobileBrand).not.toBeNull();
    expect(brandPanel).not.toBeNull();
    expect(mobileBrand.classList.contains('lg:hidden')).toBeTrue();
    expect(brandPanel.classList.contains('lg:grid')).toBeTrue();
  });
});
