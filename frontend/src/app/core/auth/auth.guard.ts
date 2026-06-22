import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Protege rotas privadas e força redirecionamento para login sem token.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasToken()) {
    return true;
  }

  return router.createUrlTree(['/signin']);
};
