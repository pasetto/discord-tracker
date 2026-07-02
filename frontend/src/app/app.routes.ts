import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { managerGuard } from './core/auth/role.guard';
import { superAdminGuard } from './core/auth/super-admin.guard';

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

const loadMemberJourneyReport = () =>
  import('./features/reports/member-journey/member-journey-report.component').then(
    (module) => module.MemberJourneyReportComponent,
  );

const loadAbsencesReport = () =>
  import('./features/reports/absences/absences-report.component').then(
    (module) => module.AbsencesReportComponent,
  );

const loadRankingReport = () =>
  import('./features/reports/ranking/ranking-report.component').then(
    (module) => module.RankingReportComponent,
  );

const loadAchievementsReport = () =>
  import('./features/reports/achievements/achievements-report.component').then(
    (module) => module.AchievementsReportComponent,
  );

const loadTextCollaborationReport = () =>
  import('./features/reports/text-collaboration/text-collaboration-report.component').then(
    (module) => module.TextCollaborationReportComponent,
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

const loadTeamSettings = () =>
  import('./features/settings/team/team-settings.component').then(
    (module) => module.TeamSettingsComponent,
  );

const loadJoinOrganization = () =>
  import('./features/organization/join-organization.component').then(
    (module) => module.JoinOrganizationComponent,
  );

const loadDiscordAdmin = () =>
  import('./features/admin/discord/discord-admin.component').then((module) => module.DiscordAdminComponent);

const loadAdminLayout = () =>
  import('./features/admin/admin-layout.component').then((module) => module.AdminLayoutComponent);

const loadAdminHome = () =>
  import('./features/admin/admin-home.component').then((module) => module.AdminHomeComponent);

const loadAdminPlans = () =>
  import('./features/admin/plans/admin-plans.component').then((module) => module.AdminPlansComponent);

const loadAdminUsers = () =>
  import('./features/admin/users/admin-users.component').then((module) => module.AdminUsersComponent);

const loadAdminOrganizations = () =>
  import('./features/admin/organizations/admin-organizations.component').then(
    (module) => module.AdminOrganizationsComponent,
  );

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
    data: page('Dashboard', 'Início'),
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
        path: 'text-collaboration',
        loadComponent: loadTextCollaborationReport,
        title: 'Sinais de texto | Syntra',
      },
      {
        path: 'goals',
        loadComponent: loadGoalsReport,
        title: 'Metas semanais | Syntra',
      },
      {
        path: 'member-journey',
        loadComponent: loadMemberJourneyReport,
        title: 'Padrões por pessoa | Syntra',
      },
      {
        path: 'absences',
        loadComponent: loadAbsencesReport,
        title: 'Ausências em andamento | Syntra',
      },
      {
        path: 'ranking',
        loadComponent: loadRankingReport,
        title: 'Ranking de colaboração | Syntra',
      },
      {
        path: 'achievements',
        loadComponent: loadAchievementsReport,
        title: 'Conquistas do time | Syntra',
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
    canActivate: [managerGuard],
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
      {
        path: 'team',
        loadComponent: loadTeamSettings,
        title: 'Time e convites | Syntra',
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
    path: 'case-studies',
    loadComponent: () =>
      import('./features/marketing/case-studies/case-study-page.component').then(
        (module) => module.CaseStudyPageComponent,
      ),
    title: 'Cases | Syntra',
  },
  {
    path: 'case-studies/:slug',
    loadComponent: () =>
      import('./features/marketing/case-studies/case-study-page.component').then(
        (module) => module.CaseStudyPageComponent,
      ),
    title: 'Case | Syntra',
  },
  {
    path: 'app/join',
    loadComponent: loadJoinOrganization,
    title: 'Entrar em organização | Syntra',
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
    canActivate: [authGuard, superAdminGuard],
    loadComponent: loadAdminLayout,
    children: [
      { path: '', pathMatch: 'full', loadComponent: loadAdminHome, title: 'Painel da plataforma | Syntra' },
      { path: 'plans', loadComponent: loadAdminPlans, title: 'Planos | Admin Syntra' },
      { path: 'users', loadComponent: loadAdminUsers, title: 'Usuários | Admin Syntra' },
      { path: 'organizations', loadComponent: loadAdminOrganizations, title: 'Organizações | Admin Syntra' },
      { path: 'discord', loadComponent: loadDiscordAdmin, title: 'Bot Discord | Admin Syntra' },
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
