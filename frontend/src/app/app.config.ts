import { APP_INITIALIZER, ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { catchError, firstValueFrom, of } from 'rxjs';

import { routes } from './app.routes';
import { PublicConfigService } from './core/api/public-config.service';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';

/**
 * Carrega configuração pública antes do bootstrap da aplicação.
 * @param publicConfigService Serviço de config pública da API.
 * @returns Factory do APP_INITIALIZER.
 */
function loadPublicConfig(publicConfigService: PublicConfigService) {
  return () =>
    firstValueFrom(publicConfigService.loadConfig().pipe(catchError(() => of(null))));
}

/**
 * Tenta renovar sessão expirada antes de renderizar rotas protegidas.
 * @param authService Serviço de autenticação do frontend
 * @returns Factory do APP_INITIALIZER
 */
function restoreAuthSession(authService: AuthService) {
  return () => firstValueFrom(authService.tryRestoreSession().pipe(catchError(() => of(false))));
}

/**
 * Configuração global de providers da aplicação Angular.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: loadPublicConfig,
      deps: [PublicConfigService],
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: restoreAuthSession,
      deps: [AuthService],
      multi: true,
    },
  ],
};
