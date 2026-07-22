import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AdminUsersComponent } from './admin-users.component';
import { AdminApiService, type AdminPlatformUser } from '../../../core/admin/admin-api.service';

describe('AdminUsersComponent', () => {
  let fixture: ComponentFixture<AdminUsersComponent>;
  let component: AdminUsersComponent;
  let adminApi: jasmine.SpyObj<AdminApiService>;

  const sampleUser: AdminPlatformUser = {
    id: 'user-1',
    email: 'owner@test.com',
    displayName: 'Owner',
    isSuperAdmin: false,
    membershipsCount: 1,
    createdAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    adminApi = jasmine.createSpyObj<AdminApiService>('AdminApiService', [
      'listUsers',
      'updateUser',
      'createUserPasswordReset',
      'resendUserPasswordReset',
    ]);
    adminApi.listUsers.and.returnValue(of({ users: [sampleUser], total: 1 }));

    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent],
      providers: [{ provide: AdminApiService, useValue: adminApi }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminUsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carrega usuários ao iniciar', () => {
    expect(component.users.length).toBe(1);
    expect(adminApi.listUsers).toHaveBeenCalled();
  });

  it('gera reset e guarda URL recuperável', () => {
    adminApi.createUserPasswordReset.and.returnValue(
      of({
        resetUrl: 'http://localhost:4200/reset-password?token=abc',
        expiresAt: new Date().toISOString(),
        emailed: true,
      }),
    );

    component.resetPassword(sampleUser);

    expect(adminApi.createUserPasswordReset).toHaveBeenCalledWith('user-1');
    expect(component.latestResets['user-1']?.resetUrl).toContain('token=abc');
    expect(component.successMessage).toContain('email enviado');
  });

  it('reenvia reset via endpoint de resend', () => {
    adminApi.resendUserPasswordReset.and.returnValue(
      of({
        resetUrl: 'http://localhost:4200/reset-password?token=def',
        expiresAt: new Date().toISOString(),
        emailed: false,
      }),
    );

    component.resendPasswordReset(sampleUser);

    expect(adminApi.resendUserPasswordReset).toHaveBeenCalledWith('user-1');
    expect(component.latestResets['user-1']?.emailed).toBeFalse();
  });

  it('mostra erro quando reset falha', () => {
    adminApi.createUserPasswordReset.and.returnValue(throwError(() => new Error('fail')));
    component.resetPassword(sampleUser);
    expect(component.errorMessage).toContain('Não foi possível gerar');
  });
});
