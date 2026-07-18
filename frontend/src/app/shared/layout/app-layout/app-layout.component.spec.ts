import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AppLayoutComponent } from './app-layout.component';
import { SidebarService } from '../../services/sidebar.service';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { PageContextService } from '../../../core/layout/page-context.service';
import { AuthService } from '../../../core/auth/auth.service';
import { OnboardingProgressService } from '../../../core/onboarding/onboarding-progress.service';

/**
 * Specs do shell autenticado: drawer mobile não pode ficar em `hidden lg:block`.
 */
describe('AppLayoutComponent', () => {
  let fixture: ComponentFixture<AppLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppLayoutComponent],
      providers: [
        provideRouter([]),
        SidebarService,
        {
          provide: TenantContextService,
          useValue: {
            refresh: () => of(null),
            guildName: null,
          },
        },
        {
          provide: PageContextService,
          useValue: {
            context$: of({ title: 'Início' }),
            refresh: jasmine.createSpy('refresh'),
          },
        },
        {
          provide: AuthService,
          useValue: {
            getDisplayName: () => 'Gestor Teste',
            getUser: () => ({ email: 'gestor@test.com' }),
            getOrganization: () => ({ name: 'Org Teste' }),
            getOrganizationId: () => 'org-test',
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
            progress$: of({ completedSteps: [], status: 'not_started' }),
            load: () => of(null),
            shouldShowOnboardingBanner: () => false,
            isOnboardingComplete: true,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppLayoutComponent);
    fixture.detectChanges();
  });

  it('deve montar sidebar e backdrop sem hidden lg:block (drawer mobile)', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-sidebar')).withContext('sidebar no DOM').not.toBeNull();
    expect(root.querySelector('app-backdrop')).withContext('backdrop no DOM').not.toBeNull();

    const hiddenWrapper = root.querySelector('.hidden.lg\\:block');
    expect(hiddenWrapper)
      .withContext('não deve esconder sidebar abaixo de lg')
      .toBeNull();
  });

  it('deve incluir bottom nav mobile', () => {
    expect(fixture.nativeElement.querySelector('app-mobile-bottom-nav')).not.toBeNull();
  });
});
