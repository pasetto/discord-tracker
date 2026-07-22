import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { LandingPageComponent } from './landing-page.component';

describe('LandingPageComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    spyOn(window, 'matchMedia').and.callFake((query: string) => {
      return {
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      } as MediaQueryList;
    });

    await TestBed.configureTestingModule({
      imports: [LandingPageComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  /**
   * Flush do GET de pricing disparado pela seção embutida.
   */
  function flushPricing(): void {
    const request = httpMock.expectOne('/api/v1/pricing');
    request.flush({ plans: [] });
  }

  it('deve criar a landing page', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    expect(fixture.componentInstance).toBeTruthy();
    fixture.detectChanges();
    flushPricing();
  });

  it('deve renderizar blocos de problema, como funciona, privacidade e FAQ', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();
    flushPricing();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="landing-problem"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="landing-how"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="landing-privacy"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="landing-faq"]')).toBeTruthy();
  });

  it('hero reforça job quem sumiu com logo e sem produtividade', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();
    flushPricing();

    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';

    expect(element.querySelector('[data-testid="landing-hero-logo"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="landing-hero-mock"]')).toBeTruthy();
    expect(text).toMatch(/quem sumiu no discord/i);
    expect(text).toMatch(/colabora/i);
    expect(text).toMatch(/criar conta/i);
    expect(text.toLowerCase()).not.toContain('produtividade');
    expect(text.toLowerCase()).not.toContain('produtivo');
    expect(text.toLowerCase()).not.toContain('ver cases');
  });

  it('privacy-section lista anti-posicionamento e metadados', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();
    flushPricing();

    const privacy = fixture.nativeElement.querySelector(
      '[data-testid="landing-privacy"]',
    ) as HTMLElement | null;
    expect(privacy).toBeTruthy();

    const text = privacy?.textContent ?? '';
    expect(text).toMatch(/metadados/i);
    expect(text).toMatch(/timesheet|ponto eletrônico|ponto eletronico/i);
    expect(text).toMatch(/screenshot|keylogger/i);
    expect(text).toMatch(/spyware|jira/i);
    expect(text).toMatch(/sem conteúdo|conteúdo de mensagem/i);
  });

  it('expõe landing-root e CTA do hero clicável sob reduced-motion', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();
    flushPricing();

    const root = fixture.nativeElement.querySelector('.landing-root') as HTMLElement | null;
    expect(root).toBeTruthy();
    expect(root?.classList.contains('has-motion')).toBe(false);

    const cta = fixture.nativeElement.querySelector(
      '[data-motion="hero-ctas"] a[routerlink="/signup"], [data-motion="hero-ctas"] a[href]',
    ) as HTMLAnchorElement | null;
    const signup = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[data-motion="hero-ctas"] a'),
    ) as HTMLAnchorElement[];
    expect(signup.length).toBeGreaterThan(0);
    expect(signup[0].textContent?.toLowerCase()).toContain('criar conta');
    void cta;
  });
});
