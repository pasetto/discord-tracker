import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthApiService } from './auth-api.service';
import { TenantContextService } from '../tenant/tenant-context.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
        AuthApiService,
        TenantContextService,
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
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

  it('invalida token expirado em isTokenValid', () => {
    const expiredPayload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 }));
    service.saveToken(`header.${expiredPayload}.signature`);
    expect(service.isTokenValid()).toBeFalse();
  });

  it('persiste sessão após login', () => {
    service.login({ email: 'owner@test.com', password: 'senha-segura' }).subscribe((session) => {
      expect(session.accessToken).toBe('access-token');
      expect(service.getToken()).toBe('access-token');
      expect(service.getDisplayName()).toBe('Eduardo');
      expect(localStorage.getItem('syntra.orgId')).toBe('org-1');
    });

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({
      accessToken: 'access-token',
      user: {
        id: 'user-1',
        email: 'owner@test.com',
        displayName: 'Eduardo',
        memberships: [{ organizationId: 'org-1', role: 'owner' }],
      },
      organization: { id: 'org-1', name: 'Econdos', slug: 'econdos' },
    });
  });
});
