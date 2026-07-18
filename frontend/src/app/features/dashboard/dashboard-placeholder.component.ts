import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexGrid,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexYAxis,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { interval, Subscription } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import {
  DashboardLiveSnapshot,
  isValidLiveDashboardSnapshot,
  LiveActivitySocketService,
  LiveMemberSnapshot,
  LiveVoiceTransitionEvent,
} from '../../core/api/live-activity-socket.service';
import { ProductTelemetryService } from '../../core/analytics/product-telemetry.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { TrackedMembersService } from '../../core/members/tracked-members.service';
import type {
  DashboardActiveAbsenceDto,
  DashboardAttentionItem,
  DashboardGoalsReportDto,
  DashboardHeatmapCell,
  DashboardInsight,
  DashboardMetricCard,
  DashboardOverviewDto,
  DashboardWeeklyChartPoint,
  IntradayInactivityReportDto,
  WeeklyInactivityEntryDto,
  WeeklyInactivityReportDto,
} from './dashboard.models';
import {
  buildAttentionItems,
  buildCollaborationHeatmap,
  buildDashboardInsights,
  mapOverviewDailyChart,
  mapOverviewHeatmapCells,
  buildWeeklyCollaborationChart,
  formatDashboardDuration,
  formatTimelineEventLabel,
  getHeatmapDayLabels,
  getHeatmapHours,
  resolveDashboardFirstName,
  resolveDashboardGreeting,
  resolveHeatmapCellClass,
  resolveMemberInitials,
  sanitizeDiscordDisplayName,
  resolveWeeklyChartAverage,
  sumCollaborationHours,
} from './dashboard.utils';
import {
  buildHealthyInactivityEmptyCopy,
  buildNoSyncedMembersCopy,
  type DashboardHealthyEmptyCopy,
  type DashboardNoMembersCopy,
} from './dashboard-empty-state.util';
import {
  getNonConcernExplainabilityEntries,
  type ExplainabilityListItem,
} from './inactivity-explainability.utils';

/**
 * Página inicial do gestor — visão operacional de colaboração e alertas de inatividade.
 */
@Component({
  selector: 'app-dashboard-placeholder',
  standalone: true,
  imports: [CommonModule, RouterLink, NgApexchartsModule],
  templateUrl: './dashboard-placeholder.component.html',
})
export class DashboardPlaceholderComponent implements OnInit, OnDestroy {
  weeklyReport: WeeklyInactivityReportDto | null = null;
  weeklyLoading = false;
  intradayReport: IntradayInactivityReportDto | null = null;
  intradayLoading = false;
  goalsReport: DashboardGoalsReportDto | null = null;
  goalsLoading = false;
  overview: DashboardOverviewDto | null = null;
  overviewLoading = false;
  trackedTotal = 0;
  activeAbsences: DashboardActiveAbsenceDto[] = [];
  liveMembers: LiveMemberSnapshot[] = [];
  onlineRanking: LiveMemberSnapshot[] = [];
  recentTransitions: LiveVoiceTransitionEvent[] = [];
  liveConnected = false;
  liveLoading = false;
  errorMessage = '';
  lastUpdatedAt: string | null = null;
  /** Indica se o total de membros rastreados já foi carregado ao menos uma vez. */
  trackedTotalLoaded = false;
  private firstUsefulViewEmitted = false;

  heatmapCells: DashboardHeatmapCell[] = [];
  readonly heatmapDayLabels = getHeatmapDayLabels();
  readonly heatmapHours = getHeatmapHours();

  weeklyChartPoints: DashboardWeeklyChartPoint[] = [];
  weeklyChartAverage = 0;
  chartSeries: ApexAxisChartSeries = [{ name: 'Horas colaborativas', data: [] }];
  chartCategories: string[] = [];
  readonly chart: ApexChart = {
    fontFamily: 'Outfit, sans-serif',
    type: 'bar',
    height: 260,
    toolbar: { show: false },
  };
  readonly chartPlotOptions: ApexPlotOptions = {
    bar: {
      horizontal: false,
      columnWidth: '48%',
      borderRadius: 6,
      borderRadiusApplication: 'end',
    },
  };
  readonly chartDataLabels: ApexDataLabels = { enabled: false };
  readonly chartStroke: ApexStroke = { show: true, width: 2, colors: ['transparent'] };
  readonly chartGrid: ApexGrid = {
    borderColor: '#e4e7ec',
    strokeDashArray: 4,
    yaxis: { lines: { show: true } },
  };
  readonly chartYAxis: ApexYAxis = {
    labels: {
      formatter: (value: number) => `${value}h`,
    },
  };
  readonly chartTooltip: ApexTooltip = {
    y: {
      formatter: (value: number) => `${value} h`,
    },
  };
  readonly chartColors = ['#465fff'];

  private subscriptions = new Subscription();

  constructor(
    private readonly httpClient: HttpClient,
    private readonly authService: AuthService,
    private readonly tenantContext: TenantContextService,
    private readonly trackedMembersService: TrackedMembersService,
    private readonly liveActivitySocket: LiveActivitySocketService,
    private readonly productTelemetry: ProductTelemetryService,
  ) {}

  /**
   * Empty state: há membros rastreados e zero alertas de atenção.
   * @returns true quando o empty state “confiável” deve aparecer
   */
  get showTrustedEmptyState(): boolean {
    return (
      this.hasGuild &&
      this.trackedTotalLoaded &&
      this.trackedTotal > 0 &&
      !this.intradayLoading &&
      !this.weeklyLoading &&
      this.attentionItems.length === 0
    );
  }

  /**
   * Empty state: servidor configurado mas nenhum membro sincronizado.
   * @returns true quando o CTA único de sincronização deve aparecer
   */
  get showSyncMembersEmptyState(): boolean {
    return (
      this.hasGuild &&
      this.trackedTotalLoaded &&
      this.trackedTotal === 0 &&
      !this.intradayLoading
    );
  }

  /** Copy do empty state saudável (0 alertas com membros). */
  get healthyEmptyCopy(): DashboardHealthyEmptyCopy {
    return buildHealthyInactivityEmptyCopy();
  }

  /** Copy do empty state sem membros sincronizados. */
  get syncMembersEmptyCopy(): DashboardNoMembersCopy {
    return buildNoSyncedMembersCopy();
  }

  /** Nome da organização ativa. */
  get organizationName(): string {
    return this.authService.getOrganization()?.name ?? 'Sua organização';
  }

  /** Nome do servidor Discord monitorado. */
  get guildName(): string {
    return this.tenantContext.guildName;
  }

  /** Indica se já há servidor selecionado. */
  get hasGuild(): boolean {
    return this.tenantContext.hasGuild;
  }

  /** Saudação contextual para o hero. */
  get greeting(): string {
    return resolveDashboardGreeting();
  }

  /** Primeiro nome do usuário logado. */
  get userFirstName(): string {
    return resolveDashboardFirstName(this.authService.getUser()?.displayName);
  }

  /** Colaboradores em alerta intradiário. */
  get intradayConcernEntries() {
    return this.intradayReport?.concernEntries ?? [];
  }

  /** Entradas em alerta no relatório semanal. */
  get weeklyConcernEntries(): WeeklyInactivityEntryDto[] {
    if (!this.weeklyReport) {
      return [];
    }

    return this.weeklyReport.entries.filter(
      (entry) => entry.status === 'missing' || entry.status === 'low_voice_collaboration',
    );
  }

  /** Metas com alerta de progresso baixo. */
  get goalsBelowThreshold(): DashboardGoalsReportDto['entries'] {
    return this.goalsReport?.entries.filter((entry) => entry.shouldAlertLowProgress) ?? [];
  }

  /** Quantidade de pessoas sem atividade hoje. */
  get noActivityTodayCount(): number {
    return this.intradayConcernEntries.filter((entry) => entry.status === 'not_started').length;
  }

  /** Quantidade de pessoas com colaboração baixa hoje. */
  get lowCollaborationTodayCount(): number {
    return this.intradayConcernEntries.filter((entry) => entry.status === 'low_collaboration_today').length;
  }

  /** Colaboradores em PTO hoje. */
  get ptoCount(): number {
    if (this.activeAbsences.length > 0) {
      return this.activeAbsences.length;
    }

    return (
      this.weeklyReport?.entries.filter((entry) => entry.status === 'on_planned_absence').length ?? 0
    );
  }

  /** Colaboradores colaborando dentro do esperado. */
  get collaboratingNormallyCount(): number {
    const activeCount =
      this.weeklyReport?.entries.filter((entry) => entry.status === 'active').length ?? 0;

    if (activeCount > 0) {
      return activeCount;
    }

    if (this.trackedTotal > 0) {
      const concernIds = new Set(
        this.intradayConcernEntries.map((entry) => entry.trackedUserId || entry.discordId),
      );
      return Math.max(0, this.trackedTotal - concernIds.size - this.ptoCount);
    }

    return 0;
  }

  /** Total de colaboradores que precisam de atenção imediata. */
  get attentionCount(): number {
    const ids = new Set<string>();
    for (const entry of this.intradayConcernEntries) {
      ids.add(entry.trackedUserId || entry.discordId);
    }
    for (const entry of this.goalsBelowThreshold) {
      ids.add(entry.trackedUserId || entry.discordId);
    }
    for (const entry of this.weeklyConcernEntries) {
      ids.add(entry.trackedUserId ?? entry.discordId ?? entry.displayName);
    }
    return ids.size;
  }

  /** Membros em voz colaborativa agora. */
  get inVoiceNowCount(): number {
    return this.liveMembers.filter((member) => member.voiceChannelId && !member.inIgnoredChannel).length;
  }

  /** Membros online agora. */
  get onlineNowCount(): number {
    return this.liveMembers.length;
  }

  /** Percentual do time online. */
  get onlinePercentLabel(): string {
    if (this.trackedTotal <= 0) {
      return '—';
    }
    return `${Math.round((this.onlineNowCount / this.trackedTotal) * 100)}% do time`;
  }

  /** Percentual do time em voz. */
  get voicePercentLabel(): string {
    if (this.trackedTotal <= 0) {
      return '—';
    }
    return `${Math.round((this.inVoiceNowCount / this.trackedTotal) * 100)}% do time`;
  }

  /** Lista unificada para o painel lateral de atenção. */
  get attentionItems(): DashboardAttentionItem[] {
    return buildAttentionItems(
      this.intradayConcernEntries,
      this.weeklyConcernEntries,
      this.goalsBelowThreshold,
    );
  }

  /**
   * Entradas “por que NÃO é sumiu” (PTO / fora da jornada / fora do dia útil).
   * @returns Lista legível derivada de `allEntries` do relatório intradiário
   */
  get explainabilityItems(): ExplainabilityListItem[] {
    return getNonConcernExplainabilityEntries(this.intradayReport?.allEntries ?? []);
  }

  /** Cartões de métricas rápidas. */
  get metricCards(): DashboardMetricCard[] {
    return [
      {
        id: 'collaborating',
        label: 'Colaborando',
        value: String(this.collaboratingNormallyCount),
        hint: this.intradayConcernEntries.length > 0 ? 'Ver alertas de hoje' : 'Dentro do esperado',
        tone: 'success',
      },
      {
        id: 'voice',
        label: 'Em voz agora',
        value: String(this.inVoiceNowCount),
        hint: this.voicePercentLabel,
        tone: 'purple',
      },
      {
        id: 'online',
        label: 'Online',
        value: String(this.onlineNowCount),
        hint: this.onlinePercentLabel,
        tone: 'brand',
      },
      {
        id: 'pto',
        label: 'Em PTO',
        value: String(this.ptoCount),
        hint: 'Hoje',
        tone: 'brand',
      },
      {
        id: 'alerts',
        label: 'Alertas ativos',
        value: String(this.attentionCount),
        hint: this.attentionCount > 0 ? 'Requer atenção' : 'Tudo certo',
        tone: this.attentionCount > 0 ? 'warning' : 'neutral',
      },
    ];
  }

  /** Insights automáticos inferidos dos dados carregados. */
  get insights(): DashboardInsight[] {
    const topWeeklyConcern = this.weeklyConcernEntries[0];
    const categoryLeader = this.resolveTopCategoryLeader();

    return buildDashboardInsights({
      intradayCount: this.intradayConcernEntries.length,
      weeklyConcernCount: this.weeklyConcernEntries.length,
      collaboratingCount: this.collaboratingNormallyCount,
      totalTracked: this.trackedTotal,
      inVoiceCount: this.inVoiceNowCount,
      ptoCount: this.ptoCount,
      topCategoryName: categoryLeader?.name,
      topCategoryCollaborationHours: categoryLeader?.hours,
      concernDisplayName: topWeeklyConcern?.displayName,
      concernInactiveDays: topWeeklyConcern?.inactiveBusinessDays,
    });
  }

  /** Eventos da timeline de hoje (mais recentes primeiro). */
  get todayTimeline(): LiveVoiceTransitionEvent[] {
    return this.recentTransitions.slice(0, 8);
  }

  /** Indica carregamento inicial dos blocos principais. */
  get isLoading(): boolean {
    return this.intradayLoading || this.weeklyLoading || this.goalsLoading || this.liveLoading || this.overviewLoading;
  }

  /** Carrega dados quando o guild estiver disponível. */
  ngOnInit(): void {
    this.subscriptions.add(
      this.liveActivitySocket.snapshot$.subscribe((snapshot) => {
        if (!isValidLiveDashboardSnapshot(snapshot)) {
          return;
        }
        this.applyLiveSnapshot(snapshot);
      }),
    );
    this.subscriptions.add(
      this.liveActivitySocket.transition$.subscribe((transition) => {
        this.recentTransitions = [transition, ...this.recentTransitions].slice(0, 30);
        this.refreshHeatmap();
      }),
    );
    this.subscriptions.add(
      this.liveActivitySocket.connected$.subscribe((connected) => {
        this.liveConnected = connected;
      }),
    );
    this.subscriptions.add(
      this.liveActivitySocket.error$.subscribe((message) => {
        this.errorMessage = message;
        this.liveLoading = false;
      }),
    );

    this.subscriptions.add(
      this.tenantContext.refresh().subscribe(() => {
        if (this.hasGuild) {
          this.loadAllData();
        } else {
          this.liveActivitySocket.disconnect();
        }
      }),
    );

    this.subscriptions.add(
      interval(5 * 60 * 1000).subscribe(() => {
        if (this.hasGuild) {
          this.loadIntradayReport();
        }
      }),
    );
  }

  /** Cancela assinaturas ao sair da tela. */
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.liveActivitySocket.disconnect();
  }

  /** Recarrega todos os blocos de dados do dashboard. */
  loadAllData(): void {
    this.loadReports();
    this.loadGoalsReport();
    this.loadOverview();
    this.loadTrackedTotal();
    this.loadActiveAbsences();
    this.connectLiveSocket();
  }

  /** Recarrega alertas intradiário e semanal. */
  loadReports(): void {
    this.loadWeeklyReport();
    this.loadIntradayReport();
  }

  /** Consulta relatório semanal resumido. */
  loadWeeklyReport(): void {
    if (!this.hasGuild) {
      return;
    }

    this.weeklyLoading = true;

    this.httpClient
      .get<{ report: WeeklyInactivityReportDto }>(
        `${this.tenantContext.getGuildApiBaseUrl()}/reports/inactivity/weekly`,
      )
      .subscribe({
        next: (response) => {
          this.weeklyReport = response.report;
          this.weeklyLoading = false;
        },
        error: () => {
          this.weeklyLoading = false;
        },
      });
  }

  /** Consulta alerta intradiário de quem sumiu hoje. */
  loadIntradayReport(): void {
    if (!this.hasGuild) {
      return;
    }

    this.intradayLoading = true;

    this.httpClient
      .get<{ report: IntradayInactivityReportDto }>(
        `${this.tenantContext.getGuildApiBaseUrl()}/reports/inactivity/intraday`,
      )
      .subscribe({
        next: (response) => {
          this.intradayReport = response.report;
          this.intradayLoading = false;
          this.maybeEmitFirstUsefulView();
        },
        error: () => {
          this.intradayLoading = false;
        },
      });
  }

  /**
   * Consulta overview histórico (7 dias + heatmap) do backend.
   */
  loadOverview(): void {
    if (!this.hasGuild) {
      return;
    }

    this.overviewLoading = true;

    this.httpClient
      .get<{ overview: DashboardOverviewDto }>(
        `${this.tenantContext.getGuildApiBaseUrl()}/dashboard/overview`,
      )
      .subscribe({
        next: (response) => {
          this.overview = response.overview;
          this.overviewLoading = false;
          this.refreshHeatmap();
          this.refreshWeeklyChart();
        },
        error: () => {
          this.overviewLoading = false;
        },
      });
  }

  /**
   * Consulta metas da semana para alertas e gráfico de colaboração.
   */
  loadGoalsReport(): void {
    if (!this.hasGuild) {
      return;
    }

    this.goalsLoading = true;

    this.httpClient
      .get<{ report: DashboardGoalsReportDto }>(
        `${this.tenantContext.getGuildApiBaseUrl()}/reports/goals`,
        { params: { preset: 'this_week' } },
      )
      .subscribe({
        next: (response) => {
          this.goalsReport = response.report;
          this.goalsLoading = false;
        },
        error: () => {
          this.goalsLoading = false;
        },
      });
  }

  /**
   * Carrega total de membros rastreados para percentuais.
   */
  loadTrackedTotal(): void {
    if (!this.hasGuild) {
      return;
    }

    this.trackedMembersService.listMembers().subscribe({
      next: (members) => {
        this.trackedTotal = members.length;
        this.trackedTotalLoaded = true;
        this.maybeEmitFirstUsefulView();
      },
      error: () => {
        this.trackedTotalLoaded = true;
      },
    });
  }

  /**
   * Carrega ausências ativas para contagem de PTO.
   */
  loadActiveAbsences(): void {
    if (!this.hasGuild) {
      return;
    }

    this.httpClient
      .get<{ absences: DashboardActiveAbsenceDto[] }>(
        `${this.tenantContext.getGuildApiBaseUrl()}/absences/active`,
      )
      .subscribe({
        next: (response) => {
          this.activeAbsences = response.absences ?? [];
        },
      });
  }

  /**
   * Classe CSS do cartão de métrica conforme tom visual.
   * @param tone Tom do cartão
   * @returns Classes tailwind do ícone
   */
  getMetricIconClass(tone: DashboardMetricCard['tone']): string {
    switch (tone) {
      case 'success':
        return 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-300';
      case 'warning':
        return 'bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-300';
      case 'purple':
        return 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300';
      case 'brand':
        return 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    }
  }

  /**
   * Classe CSS do badge de severidade na lista de atenção.
   * @param severity Severidade do item
   * @returns Classes tailwind
   */
  getAttentionMessageClass(severity: DashboardAttentionItem['severity']): string {
    switch (severity) {
      case 'critical':
        return 'text-error-600 dark:text-error-300';
      case 'warning':
        return 'text-warning-600 dark:text-warning-300';
      default:
        return 'text-brand-600 dark:text-brand-300';
    }
  }

  /**
   * Classe CSS do insight automático.
   * @param tone Tom visual do card
   * @returns Classes tailwind de borda/fundo
   */
  getInsightCardClass(tone: DashboardInsight['tone']): string {
    switch (tone) {
      case 'success':
        return 'border-success-200 bg-success-50/70 dark:border-success-900 dark:bg-success-500/10';
      case 'warning':
        return 'border-warning-200 bg-warning-50/70 dark:border-warning-900 dark:bg-warning-500/10';
      case 'error':
        return 'border-error-200 bg-error-50/70 dark:border-error-900 dark:bg-error-500/10';
      default:
        return 'border-brand-200 bg-brand-50/70 dark:border-brand-900 dark:bg-brand-500/10';
    }
  }

  /**
   * Resolve classe de intensidade do heatmap.
   * @param intensity Intensidade normalizada
   * @returns Classe tailwind
   */
  heatmapCellClass(intensity: number): string {
    return resolveHeatmapCellClass(intensity);
  }

  /**
   * Retorna célula do heatmap para dia e hora específicos.
   * @param dayIndex Índice do dia (0=Seg)
   * @param hour Hora comercial
   * @returns Célula correspondente ou intensidade zero
   */
  heatmapCell(dayIndex: number, hour: number): DashboardHeatmapCell {
    return (
      this.heatmapCells.find((cell) => cell.dayIndex === dayIndex && cell.hour === hour) ?? {
        dayIndex,
        hour,
        intensity: 0,
        eventCount: 0,
      }
    );
  }

  /**
   * Formata horário da timeline.
   * @param iso Data ISO do evento
   * @returns Hora local HH:mm
   */
  formatTimelineTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Monta rótulo amigável para evento da timeline.
   * @param transition Evento de transição
   * @returns Texto descritivo
   */
  formatTimelineLabel(transition: LiveVoiceTransitionEvent): string {
    return formatTimelineEventLabel(transition.eventType, transition.displayName, {
      fromChannelName: transition.fromChannelName,
      toChannelName: transition.toChannelName,
    });
  }

  /**
   * Resolve URL do avatar para item da timeline (evento ou membro ao vivo).
   * @param event Evento da timeline
   * @returns URL do avatar Discord ou null para fallback de iniciais
   */
  timelineAvatarUrl(event: LiveVoiceTransitionEvent): string | null {
    if (event.avatarUrl) {
      return event.avatarUrl;
    }

    const liveMember = [...this.liveMembers, ...this.onlineRanking].find(
      (member) => member.discordId === event.discordId,
    );

    return liveMember?.avatarUrl ?? null;
  }

  /**
   * Nome legível do colaborador na timeline (sem markdown Discord).
   * @param displayName Nome bruto
   * @returns Nome sanitizado
   */
  timelineDisplayName(displayName: string): string {
    return sanitizeDiscordDisplayName(displayName);
  }

  /**
   * Gera iniciais para avatar do colaborador.
   * @param displayName Nome exibido
   * @returns Iniciais
   */
  memberInitials(displayName: string): string {
    return resolveMemberInitials(displayName);
  }

  /**
   * Formata duração curta para cards auxiliares.
   * @param seconds Segundos
   * @returns Texto legível
   */
  formatDuration(seconds: number): string {
    return formatDashboardDuration(seconds);
  }

  /**
   * Conecta ao WebSocket de atividade ao vivo.
   */
  private connectLiveSocket(): void {
    if (!this.hasGuild) {
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      this.errorMessage = 'Sessão expirada. Faça login novamente.';
      return;
    }

    this.liveLoading = true;
    this.errorMessage = '';
    this.liveActivitySocket.connect(this.tenantContext.orgId, this.tenantContext.guildId, token);
  }

  /**
   * Aplica snapshot ao vivo na UI e atualiza derivados visuais.
   * @param snapshot Dados do guild
   */
  private applyLiveSnapshot(snapshot: DashboardLiveSnapshot): void {
    this.liveMembers = snapshot.activeMembers ?? [];
    this.onlineRanking = snapshot.onlineRanking ?? [];
    this.recentTransitions = snapshot.recentTransitions ?? this.recentTransitions;
    this.lastUpdatedAt = snapshot.generatedAt;
    this.liveLoading = false;
    this.refreshHeatmap();
    this.refreshWeeklyChart();
  }

  /** Recalcula heatmap a partir do overview ou fallback local. */
  private refreshHeatmap(): void {
    if (this.overview?.heatmap?.length) {
      this.heatmapCells = mapOverviewHeatmapCells(this.overview.heatmap);
      return;
    }

    this.heatmapCells = buildCollaborationHeatmap(this.recentTransitions);
  }

  /** Recalcula série do gráfico semanal a partir do overview ou fallback estimado. */
  private refreshWeeklyChart(): void {
    const members = [...this.liveMembers, ...this.onlineRanking];
    const uniqueMembers = new Map(members.map((member) => [member.discordId, member]));
    const todayLiveHours = sumCollaborationHours([...uniqueMembers.values()]);

    if (this.overview?.dailyCollaboration?.length) {
      const mapped = mapOverviewDailyChart(this.overview.dailyCollaboration, todayLiveHours);
      this.weeklyChartPoints = mapped.points;
      this.weeklyChartAverage = this.overview.weeklyAverageHours ?? mapped.average;
    } else {
      this.weeklyChartPoints = buildWeeklyCollaborationChart(
        [...uniqueMembers.values()],
        this.goalsReport?.entries ?? [],
      );
      this.weeklyChartAverage = resolveWeeklyChartAverage(this.weeklyChartPoints);
    }

    this.chartSeries = [
      {
        name: 'Horas colaborativas',
        data: this.weeklyChartPoints.map((point) => point.hours),
      },
    ];
    this.chartCategories = this.weeklyChartPoints.map((point) => point.label);
  }

  /**
   * Emite `first_useful_inactivity_view` quando o dashboard já tem dados úteis
   * (membros sincronizados ou empty state pós-setup com relatório carregado).
   * @returns {void}
   */
  private maybeEmitFirstUsefulView(): void {
    if (this.firstUsefulViewEmitted || !this.hasGuild || !this.trackedTotalLoaded) {
      return;
    }
    if (this.intradayLoading || !this.intradayReport) {
      return;
    }

    this.firstUsefulViewEmitted = true;
    this.productTelemetry.trackFirstUsefulInactivityView('dashboard', {
      trackedTotal: this.trackedTotal,
      attentionCount: this.attentionCount,
    });
  }

  /**
   * Identifica categoria com maior colaboração hoje (aproximação via metas).
   * @returns Nome da categoria e horas, se disponível
   */
  private resolveTopCategoryLeader(): { name: string; hours: number } | undefined {
    const byCategory = new Map<string, number>();

    for (const entry of this.goalsReport?.entries ?? []) {
      if (!entry.categoryName) {
        continue;
      }
      byCategory.set(
        entry.categoryName,
        (byCategory.get(entry.categoryName) ?? 0) + entry.realizedHours,
      );
    }

    let leader: { name: string; hours: number } | undefined;
    for (const [name, hours] of byCategory.entries()) {
      if (!leader || hours > leader.hours) {
        leader = { name, hours: Number(hours.toFixed(1)) };
      }
    }

    return leader;
  }
}
