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
      expect(service.getActiveOrganizations().length).toBe(1);
    });

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush({
      accessToken: 'access-token',
      user: {
        id: 'user-1',
        email: 'owner@test.com',
        displayName: 'Eduardo',
        memberships: [{ organizationId: 'org-1', role: 'owner', status: 'active' }],
      },
      organization: { id: 'org-1', name: 'Econdos', slug: 'econdos' },
      organizations: [{ id: 'org-1', name: 'Econdos', slug: 'econdos', role: 'owner', status: 'active' }],
    });

    httpMock.expectOne('/api/v1/org/org-1/discord/status').flush({
      botConnected: false,
      activeConnection: null,
    });
  });

  it('troca organização ativa', () => {
    service.saveToken('token');
    localStorage.setItem('syntra.orgId', 'org-1');

    service.switchOrganization('org-2').subscribe(() => {
      expect(localStorage.getItem('syntra.orgId')).toBe('org-2');
    });

    const req = httpMock.expectOne('/api/v1/auth/switch-organization');
    expect(req.request.body).toEqual({ organizationId: 'org-2' });
    req.flush({
      accessToken: 'token-2',
      user: {
        id: 'user-1',
        email: 'owner@test.com',
        displayName: 'Eduardo',
        memberships: [
          { organizationId: 'org-1', role: 'owner', status: 'active' },
          { organizationId: 'org-2', role: 'admin', status: 'active' },
        ],
      },
      organization: { id: 'org-2', name: 'Outra Org', slug: 'outra-org' },
      organizations: [
        { id: 'org-1', name: 'Econdos', slug: 'econdos', role: 'owner', status: 'active' },
        { id: 'org-2', name: 'Outra Org', slug: 'outra-org', role: 'admin', status: 'active' },
      ],
    });

    httpMock.expectOne('/api/v1/org/org-2/discord/status').flush({
      botConnected: false,
      activeConnection: null,
    });
  });

  it('retorna membership role da organização ativa', () => {
    localStorage.setItem('syntra.orgId', 'org-2');
    localStorage.setItem(
      'syntra.auth.organizations',
      JSON.stringify([
        { id: 'org-1', name: 'Org 1', slug: 'org-1', role: 'viewer', status: 'active' },
        { id: 'org-2', name: 'Org 2', slug: 'org-2', role: 'manager', status: 'active' },
      ]),
    );

    expect(service.getMembershipRole()).toBe('manager');
  });

  it('faz fallback para memberships do token quando lista não existe', () => {
    localStorage.setItem('syntra.orgId', 'org-9');
    const payload = btoa(
      JSON.stringify({
        memberships: [{ organizationId: 'org-9', role: 'admin' }],
      }),
    );
    service.saveToken(`header.${payload}.signature`);

    expect(service.getMembershipRole()).toBe('admin');
  });
});
