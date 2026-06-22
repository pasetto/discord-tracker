import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { AuthApiService } from './auth-api.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), AuthService, AuthApiService],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('salva, recupera e limpa token no localStorage', () => {
    service.saveToken('jwt-token');
    expect(service.getToken()).toBe('jwt-token');
    expect(service.hasToken()).toBeTrue();

    service.clearToken();
    expect(service.getToken()).toBeNull();
    expect(service.hasToken()).toBeFalse();
  });

  it('considera token vazio como ausente', () => {
    localStorage.setItem('syntra.auth.token', '   ');
    expect(service.hasToken()).toBeFalse();
  });

  it('persiste sessão após login', () => {
    service.login({ email: 'owner@test.com', password: 'senha-segura' }).subscribe((session) => {
      expect(session.accessToken).toBe('access-token');
      expect(service.getToken()).toBe('access-token');
      expect(localStorage.getItem('syntra.orgId')).toBe('org-1');
    });

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({
      accessToken: 'access-token',
      user: {
        id: 'user-1',
        email: 'owner@test.com',
        displayName: 'Owner',
        memberships: [{ organizationId: 'org-1', role: 'owner' }],
      },
      organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
    });
  });
});
