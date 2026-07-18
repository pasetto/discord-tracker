import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OnboardingProgressService } from './onboarding-progress.service';

describe('OnboardingProgressService', () => {
  let service: OnboardingProgressService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OnboardingProgressService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('retorna fallback local quando orgId está vazio', () => {
    service.load('').subscribe((progress) => {
      expect(progress.currentStep).toBe(1);
    });
  });

  it('carrega progresso da API e atualiza estado', () => {
    service.load('org-1').subscribe((progress) => {
      expect(progress.channelsConfigured).toBeTrue();
      expect(service.hasMinimumSetup).toBeTrue();
    });

    const req = httpMock.expectOne('/api/v1/org/org-1/onboarding');
    expect(req.request.method).toBe('GET');
    req.flush({
      onboarding: {
        currentStep: 5,
        completedSteps: [1, 2, 3, 4, 5],
        channelsConfigured: true,
        calendarConfigured: true,
      },
    });
  });

  it('salva progresso parcial via PUT', () => {
    service.save('org-1', { currentStep: 3 }).subscribe();

    const req = httpMock.expectOne('/api/v1/org/org-1/onboarding');
    expect(req.request.method).toBe('PUT');
    req.flush({ onboarding: { currentStep: 3, completedSteps: [1, 2, 3] } });
    expect(service.currentProgress.currentStep).toBe(3);
  });

  it('patchLocal atualiza estado sem HTTP', () => {
    const updated = service.patchLocal({ calendarConfigured: true });
    expect(updated.calendarConfigured).toBeTrue();
  });

  it('oculta banner quando onboarding foi concluído', () => {
    service.patchLocal({ completedAt: new Date().toISOString(), completedSteps: [1, 2, 3, 4, 5, 6, 7, 8] });
    expect(service.shouldShowOnboardingBanner(service.currentProgress)).toBeFalse();
  });

  it('mantém banner visível quando setup mínimo ainda não foi concluído', () => {
    service.patchLocal({ channelsConfigured: false, calendarConfigured: false, completedSteps: [1, 2, 3] });
    expect(service.shouldShowOnboardingBanner(service.currentProgress)).toBeTrue();
  });

  it('mantém banner após first-win para checklist opcional 6–7', () => {
    service.patchLocal({
      channelsConfigured: true,
      calendarConfigured: true,
      completedSteps: [1, 2, 3, 4, 5],
      currentStep: 6,
    });
    expect(service.canShowFirstWinCta(service.currentProgress)).toBeTrue();
    expect(service.hasDeferredSetup(service.currentProgress)).toBeTrue();
    expect(service.shouldShowOnboardingBanner(service.currentProgress)).toBeTrue();
  });
});
