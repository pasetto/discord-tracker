import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { OnboardingProgressService } from '../../core/onboarding/onboarding-progress.service';
import { ChannelsSettingsComponent } from '../settings/channels/channels-settings.component';
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

  it('passo 5 menciona limiares de inatividade e link secundário', () => {
    const fixture = TestBed.createComponent(OnboardingWizardComponent);
    const step5 = fixture.componentInstance.steps.find((item) => item.step === 5);
    expect(step5?.description).toContain('limiares de inatividade');
    expect(step5?.secondaryActionRoute).toBe('/app/settings/inactivity');
  });

  it('deve renderizar seletor de canais embutido no passo 4 atual', () => {
    const fixture = TestBed.createComponent(OnboardingWizardComponent);
    const onboardingProgressService = TestBed.inject(OnboardingProgressService);
    const authService = TestBed.inject(AuthService);

    onboardingProgressService.patchLocal({
      currentStep: 4,
      completedSteps: [1, 2, 3],
      botConnected: true,
      guildSelected: true,
      channelsConfigured: false,
      calendarConfigured: false,
      categoriesConfigured: false,
      membersAssigned: false,
    });
    spyOn(authService, 'getOrganizationId').and.returnValue('org-123');
    spyOn(onboardingProgressService, 'load').and.returnValue(of(onboardingProgressService.currentProgress));

    fixture.detectChanges();

    const embeddedChannels = fixture.debugElement.query(By.directive(ChannelsSettingsComponent));
    expect(embeddedChannels).toBeTruthy();
    expect(embeddedChannels.componentInstance.embedded).toBeTrue();
  });
});
