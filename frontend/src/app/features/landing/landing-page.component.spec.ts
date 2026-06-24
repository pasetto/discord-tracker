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
});
