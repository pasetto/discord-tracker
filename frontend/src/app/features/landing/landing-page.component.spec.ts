import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LandingPageComponent } from './landing-page.component';

describe('LandingPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingPageComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('deve criar a landing page', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('deve renderizar blocos de problema, como funciona e privacidade', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="landing-problem"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="landing-how"]')).toBeTruthy();
    expect(element.querySelector('[data-testid="landing-privacy"]')).toBeTruthy();
  });

  it('hero reforça job quem sumiu na colaboração sem produtividade', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toMatch(/quem sumiu/i);
    expect(text).toMatch(/colabora/i);
    expect(text.toLowerCase()).not.toContain('produtividade');
    expect(text.toLowerCase()).not.toContain('produtivo');
  });

  it('privacy-section lista anti-posicionamento explícito', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();

    const privacy = fixture.nativeElement.querySelector(
      '[data-testid="landing-privacy"]',
    ) as HTMLElement | null;
    expect(privacy).toBeTruthy();

    const text = privacy?.textContent ?? '';
    expect(text).toMatch(/não lemos|nao lemos/i);
    expect(text).toMatch(/metadados/i);
    expect(text).toMatch(/timesheet|ponto eletrônico|ponto eletronico/i);
    expect(text).toMatch(/screenshot|keylogger/i);
    expect(text).toMatch(/community|comunidade/i);
  });
});
