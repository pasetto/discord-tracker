import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

/** Segundos antes do vencimento em que o token é renovado proativamente. */
const TOKEN_REFRESH_SKEW_SECONDS = 120;

/**
 * Verifica se a requisição pertence ao fluxo de autenticação público.
 * @param url URL da requisição HTTP
 * @returns `true` quando a rota não deve disparar refresh automático
 */
function isAuthFlowRequest(url: string): boolean {
  return (
    url.includes('/api/v1/auth/login') ||
    url.includes('/api/v1/auth/register') ||
    url.includes('/api/v1/auth/refresh')
  );
}

/**
 * Indica se a requisição deve enviar cookies de sessão ao backend.
 * @param url URL da requisição HTTP
 * @returns `true` para chamadas da API
 */
function shouldSendCredentials(url: string): boolean {
  return url.startsWith('/api/');
}

/**
 * Verifica se o JWT está ausente, expirado ou perto de expirar.
 * @param token JWT de acesso
 * @returns `true` quando convém renovar antes da requisição
 */
function shouldRefreshTokenBeforeRequest(token: string | null): boolean {
  if (!token?.trim()) {
    return false;
  }

  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) {
      return true;
    }

    const payload = JSON.parse(atob(payloadSegment)) as { exp?: number };
    if (!payload.exp) {
      return true;
    }

    return payload.exp * 1000 <= Date.now() + TOKEN_REFRESH_SKEW_SECONDS * 1000;
  } catch {
    return true;
  }
}

/**
 * Clona a requisição com credenciais e Bearer quando aplicável.
 * @param request Requisição original
 * @param token Token JWT opcional
 * @returns Requisição preparada para o backend
 */
function cloneAuthorizedRequest(request: Parameters<HttpInterceptorFn>[0], token: string | null) {
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  return request.clone({
    ...(headers ? { setHeaders: headers } : {}),
    ...(shouldSendCredentials(request.url) ? { withCredentials: true } : {}),
  });
}

/**
 * Indica se o erro de refresh representa sessão expirada.
 * @param error Erro capturado no refresh
 */
function isRefreshSessionExpired(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 401;
}

/**
 * Executa a requisição e tenta refresh automático em respostas 401.
 * @param request Requisição original
 * @param next Próximo handler do interceptor
 * @param authService Serviço de autenticação
 * @param token Token JWT a ser usado
 */
function sendWithRefreshOnUnauthorized(
  request: Parameters<HttpInterceptorFn>[0],
  next: Parameters<HttpInterceptorFn>[1],
  authService: AuthService,
  token: string | null,
) {
  return next(cloneAuthorizedRequest(request, token)).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || isAuthFlowRequest(request.url)) {
        return throwError(() => error);
      }

      return authService.refreshAccessToken().pipe(
        switchMap((newToken) => next(cloneAuthorizedRequest(request, newToken))),
        catchError((refreshError) => {
          if (isRefreshSessionExpired(refreshError)) {
            authService.logout();
          }
          return throwError(() => error);
        }),
      );
    }),
  );
}

/**
 * Injeta Authorization/cookies, renova sessão proativamente e repete requisições em 401.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authService = inject(AuthService);
  const isAuthFlow = isAuthFlowRequest(request.url);

  if (isAuthFlow) {
    return next(
      request.clone({
        ...(shouldSendCredentials(request.url) ? { withCredentials: true } : {}),
      }),
    );
  }

  const token = authService.getToken();

  if (shouldRefreshTokenBeforeRequest(token)) {
    return authService.refreshAccessToken().pipe(
      switchMap((newToken) => sendWithRefreshOnUnauthorized(request, next, authService, newToken)),
      catchError((refreshError) => {
        if (authService.isTokenValid()) {
          return sendWithRefreshOnUnauthorized(request, next, authService, authService.getToken());
        }

        if (isRefreshSessionExpired(refreshError)) {
          authService.logout();
        }

        return throwError(() => refreshError);
      }),
    );
  }

  return sendWithRefreshOnUnauthorized(request, next, authService, token);
};
