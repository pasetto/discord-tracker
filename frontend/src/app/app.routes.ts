import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

/**
 * Carrega o dashboard atual como placeholder para módulos em construção.
 * @returns {Promise<unknown>} Componente lazy do dashboard.
 */
const loadDashboardPlaceholder = () =>
  import('./pages/dashboard/ecommerce/ecommerce.component').then(
    (module) => module.EcommerceComponent,
  );

/**
 * Rotas de features (esqueleto inicial com lazy loading).
 */
const featureRoutes: Routes = [
  {
    path: 'dashboard',
    loadComponent: loadDashboardPlaceholder,
    title: 'Dashboard | Syntra',
  },
  {
    path: 'reports',
    loadComponent: loadDashboardPlaceholder,
    title: 'Relatórios | Syntra',
  },
  {
    path: 'settings',
    loadComponent: loadDashboardPlaceholder,
    title: 'Configurações | Syntra',
  },
];

/**
 * Árvore principal de rotas da aplicação.
 */
export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/layout/app-layout/app-layout.component').then(
        (module) => module.AppLayoutComponent,
      ),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      ...featureRoutes,
    ],
  },
  {
    path: 'signin',
    loadComponent: () =>
      import('./pages/auth-pages/sign-in/sign-in.component').then(
        (module) => module.SignInComponent,
      ),
    title: 'Entrar | Syntra',
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./pages/auth-pages/sign-up/sign-up.component').then(
        (module) => module.SignUpComponent,
      ),
    title: 'Criar conta | Syntra',
  },
  {
    path: '**',
    loadComponent: () =>
      import('./pages/other-page/not-found/not-found.component').then(
        (module) => module.NotFoundComponent,
      ),
    title: 'Página não encontrada | Syntra',
  },
];
