import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PublicConfigService } from './public-config.service';

describe('PublicConfigService', () => {
  let service: PublicConfigService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PublicConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('carrega config pública com authMode email_password', () => {
    service.loadConfig().subscribe((config) => {
      expect(config.authMode).toBe('email_password');
      expect(config.appName).toBe('Syntra');
    });

    const req = httpMock.expectOne('/api/v1/public/config');
    req.flush({ authMode: 'email_password', appName: 'Syntra' });
    expect(service.getConfig()?.authMode).toBe('email_password');
  });
});
