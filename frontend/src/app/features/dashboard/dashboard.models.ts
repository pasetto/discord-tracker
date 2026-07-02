/** Status intradiário de alerta no dashboard. */
export type IntradayConcernStatus = 'not_started' | 'low_collaboration_today';

/** Entrada do alerta intradiário "quem sumiu hoje". */
export interface IntradayConcernEntryDto {
  trackedUserId: string;
  discordId: string;
  displayName: string;
  status: IntradayConcernStatus;
  elapsedWorkPercent: number;
  collaborationPercentOfElapsed: number;
  collaborationSecondsInWorkWindow: number;
  elapsedWorkSeconds: number;
  hasAppearedToday: boolean;
}

/** Status semanal de inatividade para contagem no dashboard. */
export type WeeklyInactivityStatus =
  | 'missing'
  | 'low_voice_collaboration'
  | 'returned'
  | 'on_planned_absence'
  | 'active';

/** Entrada resumida do relatório semanal de inatividade. */
export interface WeeklyInactivityEntryDto {
  trackedUserId?: string;
  discordId?: string;
  displayName: string;
  categoryName?: string;
  status: WeeklyInactivityStatus;
  inactiveBusinessDays?: number;
}

/** Relatório semanal resumido para widget do dashboard. */
export interface WeeklyInactivityReportDto {
  entries: WeeklyInactivityEntryDto[];
}

/** Relatório intradiário consumido pelo dashboard. */
export interface IntradayInactivityReportDto {
  generatedAt: string;
  timezone: string;
  elapsedWorkPercent: number;
  elapsedWorkSeconds: number;
  totalWorkSeconds: number;
  isBusinessDay: boolean;
  isWithinWorkHours: boolean;
  settings: {
    lateStartThresholdPercent: number;
    minCollaborationPercentOfElapsed: number;
  };
  concernEntries: IntradayConcernEntryDto[];
}

/** Linha do relatório de metas usada no dashboard. */
export interface DashboardGoalEntryDto {
  trackedUserId: string;
  discordId: string;
  displayName: string;
  categoryName?: string;
  realizedHours: number;
  progressPercent: number;
  shouldAlertLowProgress: boolean;
}

/** Relatório de metas resumido para o dashboard. */
export interface DashboardGoalsReportDto {
  periodStart: string;
  periodEnd: string;
  entries: DashboardGoalEntryDto[];
}

/** Ausência ativa exibida no dashboard. */
export interface DashboardActiveAbsenceDto {
  discordId: string;
  type: 'vacation' | 'pto' | 'sick_leave' | 'other';
}

/** Severidade visual de um item de atenção. */
export type AttentionSeverity = 'critical' | 'warning' | 'info';

/** Item unificado da lista "quem precisa de atenção". */
export interface DashboardAttentionItem {
  id: string;
  displayName: string;
  categoryName?: string;
  message: string;
  severity: AttentionSeverity;
  actionLabel: string;
  actionRoute: string;
  actionQueryParams?: Record<string, string>;
}

/** Célula do heatmap de colaboração (dia × hora). */
export interface DashboardHeatmapCell {
  dayIndex: number;
  hour: number;
  intensity: number;
  eventCount: number;
}

/** Ponto da série de colaboração dos últimos 7 dias. */
export interface DashboardWeeklyChartPoint {
  label: string;
  hours: number;
  isToday: boolean;
}

/** Insight automático exibido na faixa inferior. */
export interface DashboardInsight {
  id: string;
  icon: 'trend-up' | 'trend-down' | 'alert' | 'calendar' | 'users';
  message: string;
  tone: 'brand' | 'success' | 'warning' | 'error';
}

/** Cartão de métrica rápida no topo do dashboard. */
export interface DashboardMetricCard {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone: 'success' | 'brand' | 'warning' | 'purple' | 'neutral';
}

/** Ponto diário retornado pelo overview histórico do backend. */
export interface DashboardOverviewDailyPointDto {
  date: string;
  collaborationHours: number;
  voiceHours: number;
}

/** Célula de heatmap retornada pelo overview histórico do backend. */
export interface DashboardOverviewHeatmapCellDto {
  dayIndex: number;
  hour: number;
  eventCount: number;
}

/** Overview histórico de colaboração (7 dias + heatmap) do backend. */
export interface DashboardOverviewDto {
  generatedAt: string;
  timezone: string;
  periodStart: string;
  periodEnd: string;
  trackedMembersCount: number;
  dailyCollaboration: DashboardOverviewDailyPointDto[];
  weeklyAverageHours: number;
  heatmap: DashboardOverviewHeatmapCellDto[];
}
