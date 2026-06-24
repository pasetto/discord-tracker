import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

/**
 * Carrega o dashboard com widget de ausências.
 * @returns {Promise<unknown>} Componente lazy do dashboard.
 */
const loadDashboardPlaceholder = () =>
  import('./features/dashboard/dashboard-placeholder.component').then(
    (module) => module.DashboardPlaceholderComponent,
  );

/**
 * Carrega de forma lazy a tela de metas individuais em configurações.
 * @returns {Promise<unknown>} Componente lazy de metas.
 */
const loadGoalsSettings = () =>
  import('./features/settings/goals/goals-settings.component').then(
    (module) => module.GoalsSettingsComponent,
  );

/**
 * Carrega de forma lazy o wizard de onboarding de 8 passos.
 * @returns {Promise<unknown>} Componente lazy de onboarding.
 */
const loadOnboardingWizard = () =>
  import('./features/onboarding/onboarding-wizard.component').then(
    (module) => module.OnboardingWizardComponent,
  );

/**
 * Carrega de forma lazy o portal colaborador `/me`.
 * @returns {Promise<unknown>} Componente lazy do portal do colaborador.
 */
const loadMePortal = () =>
  import('./features/collaborator/me/me-portal.component').then(
    (module) => module.MePortalComponent,
  );

/**
 * Carrega de forma lazy o relatório de inatividade com botões de exportação.
 * @returns {Promise<unknown>} Componente lazy de relatório de inatividade.
 */
const loadInactivityReport = () =>
  import('./features/reports/inactivity/inactivity-report.component').then(
    (module) => module.InactivityReportComponent,
  );

/**
 * Carrega de forma lazy o relatório semanal de metas.
 * @returns {Promise<unknown>} Componente lazy de metas.
 */
const loadGoalsReport = () =>
  import('./features/reports/goals/goals-report.component').then(
    (module) => module.GoalsReportComponent,
  );

/**
 * Carrega de forma lazy o relatório de ausências ativas.
 * @returns {Promise<unknown>} Componente lazy de ausências ativas.
 */
const loadAbsencesReport = () =>
  import('./features/reports/absences/absences-report.component').then(
    (module) => module.AbsencesReportComponent,
  );

/**
 * Carrega de forma lazy a tela de calendário da organização.
 * @returns {Promise<unknown>} Componente lazy de calendário.
 */
const loadCalendarSettings = () =>
  import('./features/settings/calendar/calendar-settings.component').then(
    (module) => module.CalendarSettingsComponent,
  );

/**
 * Carrega de forma lazy a tela de ausências planejadas.
 * @returns {Promise<unknown>} Componente lazy de ausências.
 */
const loadAbsencesSettings = () =>
  import('./features/settings/absences/absences-settings.component').then(
    (module) => module.AbsencesSettingsComponent,
  );

const loadInactivitySettings = () =>
  import('./features/settings/inactivity/inactivity-settings.component').then(
    (module) => module.InactivitySettingsComponent,
  );

/**
 * Carrega de forma lazy a tela de gamificação por guild.
 * @returns {Promise<unknown>} Componente lazy de gamificação.
 */
const loadGamificationSettings = () =>
  import('./features/settings/gamification/gamification-settings.component').then(
    (module) => module.GamificationSettingsComponent,
  );

const loadCategoriesSettings = () =>
  import('./features/settings/categories/categories-settings.component').then(
    (module) => module.CategoriesSettingsComponent,
  );

const loadChannelsSettings = () =>
  import('./features/settings/channels/channels-settings.component').then(
    (module) => module.ChannelsSettingsComponent,
  );

const loadDiscordSettings = () =>
  import('./features/settings/discord/discord-settings.component').then(
    (module) => module.DiscordSettingsComponent,
  );

const loadDiscordAdmin = () =>
  import('./features/admin/discord/discord-admin.component').then((module) => module.DiscordAdminComponent);

const loadSignIn = () =>
  import('./pages/auth-pages/sign-in/sign-in.component').then((module) => module.SignInComponent);

/**
 * Rotas de features da aplicação autenticada.
 */
const featureRoutes: Routes = [
  {
    path: 'dashboard',
    loadComponent: loadDashboardPlaceholder,
    title: 'Dashboard | Syntra',
  },
  {
    path: 'reports',
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'inactivity',
      },
      {
        path: 'inactivity',
        loadComponent: loadInactivityReport,
        title: 'Relatório de inatividade | Syntra',
      },
      {
        path: 'goals',
        loadComponent: loadGoalsReport,
        title: 'Relatório de metas | Syntra',
      },
      {
        path: 'absences',
        loadComponent: loadAbsencesReport,
        title: 'Ausências ativas | Syntra',
      },
    ],
    title: 'Relatórios | Syntra',
  },
  {
    path: 'onboarding',
    loadComponent: loadOnboardingWizard,
    title: 'Onboarding | Syntra',
  },
  {
    path: 'me',
    loadComponent: loadMePortal,
    title: 'Meu portal | Syntra',
  },
  {
    path: 'settings',
    title: 'Configurações | Syntra',
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'discord',
      },
      {
        path: 'categories',
        loadComponent: loadCategoriesSettings,
        title: 'Categorias do time | Syntra',
      },
      {
        path: 'channels',
        loadComponent: loadChannelsSettings,
        title: 'Canais colaborativos | Syntra',
      },
      {
        path: 'discord',
        loadComponent: loadDiscordSettings,
        title: 'Conexão Discord | Syntra',
      },
      {
        path: 'goals',
        loadComponent: loadGoalsSettings,
        title: 'Metas individuais | Syntra',
      },
      {
        path: 'calendar',
        loadComponent: loadCalendarSettings,
        title: 'Calendário de trabalho | Syntra',
      },
      {
        path: 'absences',
        loadComponent: loadAbsencesSettings,
        title: 'Ausências planejadas | Syntra',
      },
      {
        path: 'inactivity',
        loadComponent: loadInactivitySettings,
        title: 'Inatividade | Syntra',
      },
      {
        path: 'gamification',
        loadComponent: loadGamificationSettings,
        title: 'Gamificação | Syntra',
      },
    ],
  },
];

/**
 * Árvore principal de rotas da aplicação.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'landing',
    loadComponent: () =>
      import('./features/landing/landing-page.component').then(
        (module) => module.LandingPageComponent,
      ),
    title: 'Syntra | Colaboração no Discord',
  },
  {
    path: 'app',
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
    path: 'onboarding',
    pathMatch: 'full',
    redirectTo: 'app/onboarding',
  },
  {
    path: 'me',
    pathMatch: 'full',
    redirectTo: 'app/me',
  },
  {
    path: 'admin',
    canActivate: [authGuard],
    children: [
      {
        path: 'discord',
        loadComponent: loadDiscordAdmin,
        title: 'Admin Discord | Syntra',
      },
    ],
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: loadSignIn,
    title: 'Entrar | Syntra',
  },
  {
    path: 'signin',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/auth-pages/sign-up/sign-up.component').then(
        (module) => module.SignUpComponent,
      ),
    title: 'Criar conta | Syntra',
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
