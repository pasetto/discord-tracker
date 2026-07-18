import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FaqSectionComponent } from './faq-section.component';

describe('FaqSectionComponent', () => {
  let fixture: ComponentFixture<FaqSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FaqSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FaqSectionComponent);
    fixture.detectChanges();
  });

  it('lista FAQ de metadados e anti-vigilância', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toMatch(/leem as mensagens/i);
    expect(text).toMatch(/vigilância|vigilancia/i);
    expect(text).toMatch(/timesheet/i);
    expect(text).toMatch(/cartão|cartao/i);
    expect(text.toLowerCase()).not.toContain('produtividade');
  });

  it('accordion alterna resposta aberta', () => {
    const second = fixture.nativeElement.querySelector(
      '[data-testid="landing-faq-q-1"]',
    ) as HTMLButtonElement;
    second.click();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="landing-faq-a-1"]'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('[data-testid="landing-faq-a-0"]'),
    ).toBeFalsy();
  });
});
