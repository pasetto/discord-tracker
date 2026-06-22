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

  it('carrega config pública e expõe discordAuthPath', () => {
    service.loadConfig().subscribe((config) => {
      expect(config.discordAuthPath).toBe('/api/v1/auth/discord');
    });

    const req = httpMock.expectOne('/api/v1/public/config');
    req.flush({ discordAuthPath: '/api/v1/auth/discord', appName: 'Syntra' });
    expect(service.getDiscordAuthPath()).toBe('/api/v1/auth/discord');
  });

  it('usa fallback de OAuth quando config não foi carregada', () => {
    expect(service.getDiscordAuthPath()).toBe('/api/v1/auth/discord');
  });
});
