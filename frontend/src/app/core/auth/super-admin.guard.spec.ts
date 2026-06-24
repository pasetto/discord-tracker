import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { superAdminGuard } from './super-admin.guard';
import { AuthService } from './auth.service';

describe('superAdminGuard', () => {
  it('permite acesso quando usuário é super admin', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            hasToken: () => true,
            isSuperAdmin: () => true,
          },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() => superAdminGuard({} as never, {} as never));
    expect(result).toBeTrue();
  });

  it('redireciona quando usuário não é super admin', () => {
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        {
          provide: AuthService,
          useValue: {
            hasToken: () => true,
            isSuperAdmin: () => false,
          },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() => superAdminGuard({} as never, {} as never));
    expect(result).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/app/dashboard']);
  });
});
