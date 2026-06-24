import { HttpErrorResponse, HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;
  const getToken = jasmine.createSpy('getToken');
  const refreshAccessToken = jasmine.createSpy('refreshAccessToken');
  const logout = jasmine.createSpy('logout');
  const validJwtToken = `header.${btoa(JSON.stringify({ exp: 4102444800 }))}.signature`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getToken,
            refreshAccessToken,
            logout,
          },
        },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
    getToken.calls.reset();
    refreshAccessToken.calls.reset();
    logout.calls.reset();
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('anexa Authorization Bearer quando token existir', () => {
    getToken.and.returnValue(validJwtToken);

    httpClient.get('/api/v1/test').subscribe();
    const request = httpTestingController.expectOne('/api/v1/test');

    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${validJwtToken}`);
    request.flush({});
  });

  it('não anexa Authorization quando token não existir', () => {
    getToken.and.returnValue(null);

    httpClient.get('/api/v1/test').subscribe();
    const request = httpTestingController.expectOne('/api/v1/test');

    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({});
  });

  it('renova sessão e repete requisição em resposta 401', () => {
    getToken.and.returnValue(validJwtToken);
    refreshAccessToken.and.returnValue(of('new-jwt-token'));

    let responseBody: unknown;
    httpClient.get('/api/v1/me/collaboration').subscribe({
      next: (body) => {
        responseBody = body;
      },
    });

    const firstRequest = httpTestingController.expectOne('/api/v1/me/collaboration');
    expect(firstRequest.request.withCredentials).toBeTrue();
    firstRequest.flush({ error: 'Sessão expirada' }, { status: 401, statusText: 'Unauthorized' });

    const retryRequest = httpTestingController.expectOne('/api/v1/me/collaboration');
    expect(retryRequest.request.headers.get('Authorization')).toBe('Bearer new-jwt-token');
    retryRequest.flush({ summary: { ok: true } });

    expect(refreshAccessToken).toHaveBeenCalled();
    expect(responseBody).toEqual({ summary: { ok: true } });
  });

  it('encerra sessão quando refresh falhar após 401', () => {
    getToken.and.returnValue(validJwtToken);
    refreshAccessToken.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' })),
    );

    httpClient.get('/api/v1/me/collaboration').subscribe({
      error: () => {},
    });

    const firstRequest = httpTestingController.expectOne('/api/v1/me/collaboration');
    firstRequest.flush({ error: 'Sessão expirada' }, { status: 401, statusText: 'Unauthorized' });

    expect(refreshAccessToken).toHaveBeenCalled();
    expect(logout).toHaveBeenCalled();
  });

  it('não encerra sessão quando refresh falhar por erro de rede', () => {
    getToken.and.returnValue(validJwtToken);
    refreshAccessToken.and.returnValue(throwError(() => new Error('network error')));

    httpClient.get('/api/v1/me/collaboration').subscribe({
      error: () => {},
    });

    const firstRequest = httpTestingController.expectOne('/api/v1/me/collaboration');
    firstRequest.flush({ error: 'Sessão expirada' }, { status: 401, statusText: 'Unauthorized' });

    expect(refreshAccessToken).toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
  });
});
