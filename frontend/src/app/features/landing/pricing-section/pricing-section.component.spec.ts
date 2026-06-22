import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PricingSectionComponent } from './pricing-section.component';

describe('PricingSectionComponent', () => {
  let fixture: ComponentFixture<PricingSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PricingSectionComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PricingSectionComponent);
    fixture.detectChanges();
  });

  it('renderiza os cards de preços em BRL', () => {
    const content = fixture.nativeElement.textContent as string;

    expect(content).toContain('Starter');
    expect(content).toContain('Team');
    expect(content).toContain('R$ 79');
    expect(content).toContain('R$ 149');
  });
});
