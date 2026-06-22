import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../auth/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;
  const getToken = jasmine.createSpy('getToken');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getToken,
          },
        },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
    getToken.calls.reset();
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('anexa Authorization Bearer quando token existir', () => {
    getToken.and.returnValue('jwt-token');

    httpClient.get('/api/v1/test').subscribe();
    const request = httpTestingController.expectOne('/api/v1/test');

    expect(request.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    request.flush({});
  });

  it('não anexa Authorization quando token não existir', () => {
    getToken.and.returnValue(null);

    httpClient.get('/api/v1/test').subscribe();
    const request = httpTestingController.expectOne('/api/v1/test');

    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({});
  });
});
