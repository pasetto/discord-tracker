import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeroLiveMockComponent } from './hero-live-mock.component';

describe('HeroLiveMockComponent', () => {
  let fixture: ComponentFixture<HeroLiveMockComponent>;
  let component: HeroLiveMockComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroLiveMockComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroLiveMockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o mock com Com Syntra como default', () => {
    expect(component.mode).toBe('with');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toMatch(/três pessoas sumiram/i);
    expect(text).toMatch(/colaborando/i);
    expect(text).toMatch(/sumiu/i);
    expect(text).toMatch(/em pto/i);
  });

  it('toggle Sem Syntra troca chips para Online e headline de confusão', () => {
    const withoutBtn = fixture.nativeElement.querySelector(
      '[data-testid="landing-hero-toggle-without"]',
    ) as HTMLButtonElement;
    withoutBtn.click();
    fixture.detectChanges();

    expect(component.mode).toBe('without');
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    expect(text).toMatch(/todo mundo/i);
    expect(text).toMatch(/ninguém sabe quem sumiu/i);

    const chips = Array.from(
      root.querySelectorAll('[data-status]'),
    ) as HTMLElement[];
    expect(chips.length).toBe(5);
    expect(chips.every((chip) => chip.getAttribute('data-status') === 'online')).toBe(
      true,
    );
    expect(text.toLowerCase()).not.toContain('produtividade');
  });

  it('toggle Com Syntra restaura mix Colaborando / Sumiu / Em PTO', () => {
    component.setMode('without');
    fixture.detectChanges();

    const withBtn = fixture.nativeElement.querySelector(
      '[data-testid="landing-hero-toggle-with"]',
    ) as HTMLButtonElement;
    withBtn.click();
    fixture.detectChanges();

    const statuses = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[data-status]'),
    ).map((el) => el.getAttribute('data-status'));

    expect(statuses).toContain('collaborating');
    expect(statuses).toContain('missing');
    expect(statuses).toContain('pto');
  });
});
