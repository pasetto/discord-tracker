import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager']);
const VIEWER_ROLES = new Set(['owner', 'admin', 'manager', 'viewer']);

/**
 * Bloqueia acesso para papéis abaixo de gestão (owner/admin/manager).
 */
export const managerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const role = authService.getMembershipRole();

  if (role && MANAGER_ROLES.has(role)) {
    return true;
  }

  return router.createUrlTree(['/app/dashboard']);
};

/**
 * Bloqueia acesso para usuários sem membership de leitura no tenant.
 */
export const viewerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const role = authService.getMembershipRole();

  if (role && VIEWER_ROLES.has(role)) {
    return true;
  }

  return router.createUrlTree(['/app/dashboard']);
};
