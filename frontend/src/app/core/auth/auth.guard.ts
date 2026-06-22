import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Protege rotas privadas e redireciona para `/login` quando não há token.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasToken()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};

/**
 * Impede acesso às telas de login/cadastro quando o usuário já está autenticado.
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.hasToken()) {
    return true;
  }

  return router.createUrlTree(['/app/dashboard']);
};
