import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { JoinOrganizationComponent } from './join-organization.component';
import { AuthService } from '../../core/auth/auth.service';
import { of } from 'rxjs';

describe('JoinOrganizationComponent', () => {
  let fixture: ComponentFixture<JoinOrganizationComponent>;
  let httpMock: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', [
      'isTokenValid',
      'joinOrganization',
      'getOrganizations',
    ]);
    authService.isTokenValid.and.returnValue(false);
    authService.getOrganizations.and.returnValue([]);

    await TestBed.configureTestingModule({
      imports: [JoinOrganizationComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'app/dashboard', redirectTo: '' }]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(JoinOrganizationComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('valida código de convite e exibe organização para visitante', () => {
    fixture.componentInstance.inviteCode = 'AB12CD34';
    fixture.componentInstance.previewInvite();

    const req = httpMock.expectOne('/api/v1/public/invite-codes/AB12CD34');
    req.flush({
      organizationId: 'org-2',
      organizationName: 'Acme Corp',
      inviteCode: 'AB12CD34',
    });
    fixture.detectChanges();

    expect((fixture.nativeElement.textContent as string)).toContain('Acme Corp');
    expect((fixture.nativeElement.textContent as string)).toContain('Criar conta e solicitar acesso');
  });

  it('envia solicitação quando usuário autenticado', () => {
    authService.isTokenValid.and.returnValue(true);
    fixture.componentInstance.inviteCode = 'AB12CD34';
    fixture.componentInstance.preview = {
      organizationId: 'org-2',
      organizationName: 'Acme Corp',
      inviteCode: 'AB12CD34',
    };
    authService.joinOrganization.and.returnValue(
      of({
        accessToken: 'token',
        user: {
          id: 'user-1',
          email: 'user@test.com',
          displayName: 'User',
          memberships: [],
        },
        organization: null,
        organizations: [{ id: 'org-2', name: 'Acme Corp', slug: 'acme', role: 'viewer', status: 'pending' }],
      }),
    );

    fixture.componentInstance.submitJoinRequest();
    fixture.detectChanges();

    expect(authService.joinOrganization).toHaveBeenCalledWith('AB12CD34');
    expect(fixture.componentInstance.successMessage).toContain('Aguarde aprovação');
  });
});
