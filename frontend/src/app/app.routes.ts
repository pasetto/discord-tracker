import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

/** Metadados padrão de página para o header contextual. */
const page = (title: string, breadcrumbLabel?: string) => ({
  pageTitle: title,
  ...(breadcrumbLabel ? { breadcrumbLabel } : {}),
});

const loadDashboardPlaceholder = () =>
  import('./features/dashboard/dashboard-placeholder.component').then(
    (module) => module.DashboardPlaceholderComponent,
  );

const loadLiveTeam = () =>
  import('./features/live/live-team.component').then((module) => module.LiveTeamComponent);

const loadReportsHub = () =>
  import('./features/reports/reports-hub.component').then((module) => module.ReportsHubComponent);

const loadGoalsSettings = () =>
  import('./features/settings/goals/goals-settings.component').then(
    (module) => module.GoalsSettingsComponent,
  );

const loadOnboardingWizard = () =>
  import('./features/onboarding/onboarding-wizard.component').then(
    (module) => module.OnboardingWizardComponent,
  );

const loadMePortal = () =>
  import('./features/collaborator/me/me-portal.component').then(
    (module) => module.MePortalComponent,
  );

const loadInactivityReport = () =>
  import('./features/reports/inactivity/inactivity-report.component').then(
    (module) => module.InactivityReportComponent,
  );

const loadGoalsReport = () =>
  import('./features/reports/goals/goals-report.component').then(
    (module) => module.GoalsReportComponent,
  );

const loadAbsencesReport = () =>
  import('./features/reports/absences/absences-report.component').then(
    (module) => module.AbsencesReportComponent,
  );

const loadCalendarSettings = () =>
  import('./features/settings/calendar/calendar-settings.component').then(
    (module) => module.CalendarSettingsComponent,
  );

const loadAbsencesSettings = () =>
  import('./features/settings/absences/absences-settings.component').then(
    (module) => module.AbsencesSettingsComponent,
  );

const loadInactivitySettings = () =>
  import('./features/settings/inactivity/inactivity-settings.component').then(
    (module) => module.InactivitySettingsComponent,
  );

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
    title: 'Início | Syntra',
    data: page('Início', 'Início'),
  },
  {
    path: 'live',
    loadComponent: loadLiveTeam,
    title: 'Time ao vivo | Syntra',
    data: page('Time ao vivo', 'Time ao vivo'),
  },
  {
    path: 'reports',
    loadComponent: loadReportsHub,
    data: page('Relatórios', 'Relatórios'),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'inactivity',
      },
      {
        path: 'inactivity',
        loadComponent: loadInactivityReport,
        title: 'Quem sumiu | Syntra',
      },
      {
        path: 'goals',
        loadComponent: loadGoalsReport,
        title: 'Metas semanais | Syntra',
      },
      {
        path: 'absences',
        loadComponent: loadAbsencesReport,
        title: 'Ausências em andamento | Syntra',
      },
    ],
  },
  {
    path: 'onboarding',
    loadComponent: loadOnboardingWizard,
    title: 'Configuração inicial | Syntra',
    data: page('Configuração inicial', 'Setup'),
  },
  {
    path: 'me',
    loadComponent: loadMePortal,
    title: 'Meu portal | Syntra',
    data: page('Meu portal', 'Meu portal'),
  },
  {
    path: 'settings',
    title: 'Configurações | Syntra',
    data: page('Configurações', 'Configurações'),
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
        title: 'Cadastrar PTO | Syntra',
      },
      {
        path: 'inactivity',
        loadComponent: loadInactivitySettings,
        title: 'Limiares de inatividade | Syntra',
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
