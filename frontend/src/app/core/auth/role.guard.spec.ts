import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { managerGuard, viewerGuard } from './role.guard';

describe('role guards', () => {
  it('permite managerGuard para admin', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            getMembershipRole: () => 'admin',
          },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() => managerGuard({} as never, {} as never));
    expect(result).toBeTrue();
  });

  it('redireciona managerGuard para viewer', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            getMembershipRole: () => 'viewer',
          },
        },
      ],
    });

    const router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() => managerGuard({} as never, {} as never));
    expect(result instanceof UrlTree).toBeTrue();
    expect(router.serializeUrl(result as UrlTree)).toBe('/app/dashboard');
  });

  it('permite viewerGuard para viewer', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            getMembershipRole: () => 'viewer',
          },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() => viewerGuard({} as never, {} as never));
    expect(result).toBeTrue();
  });
});
