import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/**
 * Impede acesso a rotas `/admin` para usuários que não são super admin.
 */
export const superAdminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.hasToken() || !authService.isSuperAdmin()) {
    void router.navigate(['/app/dashboard']);
    return false;
  }

  return true;
};
