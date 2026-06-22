import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OnboardingWizardComponent } from './onboarding-wizard.component';

describe('OnboardingWizardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnboardingWizardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  it('deve criar o wizard de onboarding', () => {
    const fixture = TestBed.createComponent(OnboardingWizardComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
