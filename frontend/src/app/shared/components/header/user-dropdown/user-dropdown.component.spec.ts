import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { UserDropdownComponent } from './user-dropdown.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { OnboardingProgressService } from '../../../../core/onboarding/onboarding-progress.service';
import { createInitialOnboardingProgress } from '../../../../core/onboarding/onboarding-progress.model';

describe('UserDropdownComponent', () => {
  let fixture: ComponentFixture<UserDropdownComponent>;
  const progressSubject = new BehaviorSubject(createInitialOnboardingProgress());

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserDropdownComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            getDisplayName: () => 'Gestor Teste',
            getUser: () => ({ email: 'gestor@test.com' }),
            getOrganization: () => ({ name: 'Org Teste' }),
            getOrganizationId: () => 'org-1',
            getActiveOrganizations: () => [],
            isSuperAdmin: () => false,
            syncSession: () => of(undefined),
            switchOrganization: () => of(undefined),
            logout: jasmine.createSpy('logout'),
          },
        },
        {
          provide: OnboardingProgressService,
          useValue: {
            progress$: progressSubject.asObservable(),
            isOnboardingComplete: false,
            load: jasmine.createSpy('load').and.returnValue(progressSubject.asObservable()),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserDropdownComponent);
    fixture.detectChanges();
  });

  it('deve criar o dropdown do usuário', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('deve exibir link de configuração inicial enquanto onboarding não concluído', () => {
    progressSubject.next({ ...createInitialOnboardingProgress(), completedSteps: [1] });
    fixture.componentInstance.toggleDropdown();
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a[href="/app/onboarding"]');
    expect(link).toBeTruthy();
  });

  it('deve ocultar link de configuração inicial quando onboarding concluído', () => {
    progressSubject.next({
      ...createInitialOnboardingProgress(),
      completedSteps: [1, 2, 3, 4, 5, 6, 7, 8],
      completedAt: new Date().toISOString(),
    });
    fixture.componentInstance.toggleDropdown();
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a[href="/app/onboarding"]');
    expect(link).toBeFalsy();
  });
});
