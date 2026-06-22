import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { PublicConfigService } from '../api/public-config.service';

describe('AuthService', () => {
  const getDiscordAuthPath = jasmine.createSpy('getDiscordAuthPath').and.returnValue('/api/v1/auth/discord');

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        {
          provide: PublicConfigService,
          useValue: {
            getDiscordAuthPath,
          },
        },
      ],
    });
  });

  it('salva, recupera e limpa token no localStorage', () => {
    const service = TestBed.inject(AuthService);

    service.saveToken('jwt-token');
    expect(service.getToken()).toBe('jwt-token');
    expect(service.hasToken()).toBeTrue();

    service.clearToken();
    expect(service.getToken()).toBeNull();
    expect(service.hasToken()).toBeFalse();
  });

  it('considera token vazio como ausente', () => {
    const service = TestBed.inject(AuthService);
    localStorage.setItem('syntra.auth.token', '   ');

    expect(service.hasToken()).toBeFalse();
  });

});
