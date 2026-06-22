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
});
