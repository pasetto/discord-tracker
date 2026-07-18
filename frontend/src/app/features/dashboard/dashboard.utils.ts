import type { LiveMemberSnapshot, LiveVoiceTransitionEvent } from '../../core/api/live-activity-socket.service';
import type {
  DashboardAttentionItem,
  DashboardGoalEntryDto,
  DashboardHeatmapCell,
  DashboardInsight,
  DashboardOverviewDto,
  DashboardOverviewHeatmapCellDto,
  DashboardWeeklyChartPoint,
  FirstValueChecklistItem,
  IntradayConcernEntryDto,
  WeeklyInactivityEntryDto,
} from './dashboard.models';

const HEATMAP_DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const HEATMAP_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

/**
 * Retorna saudação contextual conforme horário local do navegador.
 * @param date Data de referência
 * @returns Saudação em português
 */
export function resolveDashboardGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) {
    return 'Bom dia';
  }
  if (hour < 18) {
    return 'Boa tarde';
  }
  return 'Boa noite';
}

/**
 * Extrai o primeiro nome de um display name para personalização do hero.
 * @param displayName Nome completo do usuário
 * @returns Primeiro token do nome ou fallback genérico
 */
export function resolveDashboardFirstName(displayName: string | null | undefined): string {
  const trimmed = displayName?.trim();
  if (!trimmed) {
    return 'Gestor';
  }
  return trimmed.split(/\s+/)[0] ?? 'Gestor';
}

/**
 * Gera iniciais de avatar a partir do nome do colaborador.
 * @param displayName Nome exibido
 * @returns Até duas letras maiúsculas
 */
export function resolveMemberInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

/**
 * Converte índice de dia JS (0=Dom) para índice do heatmap (0=Seg).
 * @param jsDay Índice retornado por Date.getDay()
 * @returns Índice 0–6 iniciando na segunda-feira
 */
export function mapJsDayToHeatmapIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Monta matriz de intensidade do heatmap a partir de transições colaborativas recentes.
 * @param transitions Eventos de voz/texto do feed ao vivo
 * @param referenceDate Data de referência para o eixo temporal
 * @returns Lista de células com intensidade normalizada 0–1
 */
export function buildCollaborationHeatmap(
  transitions: LiveVoiceTransitionEvent[],
  referenceDate = new Date(),
): DashboardHeatmapCell[] {
  const counts = new Map<string, number>();

  for (const transition of transitions) {
    if (!transition.countsAsCollaboration) {
      continue;
    }

    const occurredAt = new Date(transition.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      continue;
    }

    const dayIndex = mapJsDayToHeatmapIndex(occurredAt.getDay());
    const hour = occurredAt.getHours();
    if (!HEATMAP_HOURS.includes(hour)) {
      continue;
    }

    const key = `${dayIndex}:${hour}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const maxCount = Math.max(1, ...counts.values());
  const cells: DashboardHeatmapCell[] = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    for (const hour of HEATMAP_HOURS) {
      const eventCount = counts.get(`${dayIndex}:${hour}`) ?? 0;
      cells.push({
        dayIndex,
        hour,
        eventCount,
        intensity: eventCount / maxCount,
      });
    }
  }

  // Reforça colaboração ativa atual nas horas de trabalho do dia de referência.
  const todayIndex = mapJsDayToHeatmapIndex(referenceDate.getDay());
  const currentHour = referenceDate.getHours();
  if (HEATMAP_HOURS.includes(currentHour)) {
    const todayKey = `${todayIndex}:${currentHour}`;
    const existing = cells.find((cell) => cell.dayIndex === todayIndex && cell.hour === currentHour);
    if (existing && existing.eventCount === 0) {
      existing.eventCount = 1;
      existing.intensity = 0.35;
    }
  }

  return cells;
}

/**
 * Retorna rótulos dos dias do heatmap.
 * @returns Lista fixa Seg–Dom
 */
export function getHeatmapDayLabels(): string[] {
  return [...HEATMAP_DAY_LABELS];
}

/**
 * Retorna horas exibidas no eixo do heatmap.
 * @returns Horas comerciais 8h–17h
 */
export function getHeatmapHours(): number[] {
  return [...HEATMAP_HOURS];
}

/**
 * Resolve classe Tailwind para intensidade do heatmap.
 * @param intensity Valor normalizado 0–1
 * @returns Classe de fundo azul proporcional à intensidade
 */
export function resolveHeatmapCellClass(intensity: number): string {
  if (intensity >= 0.85) {
    return 'bg-brand-600';
  }
  if (intensity >= 0.6) {
    return 'bg-brand-500';
  }
  if (intensity >= 0.35) {
    return 'bg-brand-400';
  }
  if (intensity >= 0.15) {
    return 'bg-brand-200 dark:bg-brand-500/30';
  }
  return 'bg-brand-50 dark:bg-brand-500/10';
}

/**
 * Converte heatmap do overview API em células com intensidade normalizada.
 * @param cells Células brutas do backend
 * @returns Células prontas para renderização CSS
 */
export function mapOverviewHeatmapCells(
  cells: DashboardOverviewHeatmapCellDto[],
): DashboardHeatmapCell[] {
  const maxCount = Math.max(1, ...cells.map((cell) => cell.eventCount));
  return cells.map((cell) => ({
    dayIndex: cell.dayIndex,
    hour: cell.hour,
    eventCount: cell.eventCount,
    intensity: cell.eventCount / maxCount,
  }));
}

/**
 * Converte série diária do overview em pontos do gráfico semanal.
 * @param daily Pontos diários do backend
 * @param todayCollaborationHours Horas ao vivo de hoje para mesclar no último ponto
 * @returns Pontos do gráfico e média semanal
 */
export function mapOverviewDailyChart(
  daily: DashboardOverviewDto['dailyCollaboration'],
  todayCollaborationHours?: number,
): { points: DashboardWeeklyChartPoint[]; average: number } {
  const points = daily.map((point, index, arr) => {
    const date = new Date(`${point.date}T12:00:00`);
    const label = Number.isNaN(date.getTime())
      ? point.date
      : date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    const isToday = index === arr.length - 1;
    let hours = point.collaborationHours;

    if (isToday && todayCollaborationHours !== undefined) {
      hours = Math.max(hours, todayCollaborationHours);
    }

    return { label, hours, isToday };
  });

  const average =
    points.length > 0
      ? Number((points.reduce((sum, point) => sum + point.hours, 0) / points.length).toFixed(1))
      : 0;

  return { points, average };
}

/**
 * Monta série dos últimos 7 dias combinando snapshot ao vivo e metas acumuladas.
 * @param liveMembers Membros do snapshot ao vivo
 * @param goalEntries Entradas do relatório de metas do período
 * @param referenceDate Data de referência
 * @returns Pontos ordenados para gráfico de barras
 */
export function buildWeeklyCollaborationChart(
  liveMembers: LiveMemberSnapshot[],
  goalEntries: DashboardGoalEntryDto[],
  referenceDate = new Date(),
): DashboardWeeklyChartPoint[] {
  const todayHours = sumCollaborationHours(liveMembers);
  const weekTotalHours = goalEntries.reduce((sum, entry) => sum + (entry.realizedHours ?? 0), 0);
  const points: DashboardWeeklyChartPoint[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(referenceDate);
    date.setDate(referenceDate.getDate() - offset);
    const isToday = offset === 0;
    const label = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    let hours = 0;

    if (isToday) {
      hours = todayHours;
    } else if (weekTotalHours > 0) {
      hours = Number(((weekTotalHours - todayHours) / 6).toFixed(1));
      if (hours < 0) {
        hours = 0;
      }
    }

    points.push({ label, hours, isToday });
  }

  return points;
}

/**
 * Soma horas colaborativas do dia a partir do snapshot ao vivo.
 * @param members Membros retornados pelo dashboard live
 * @returns Total em horas com uma casa decimal
 */
export function sumCollaborationHours(members: LiveMemberSnapshot[]): number {
  const totalSeconds = members.reduce((sum, member) => sum + (member.collaborationActiveSeconds ?? 0), 0);
  return Number((totalSeconds / 3600).toFixed(1));
}

/**
 * Calcula média da série semanal para linha de referência no gráfico.
 * @param points Pontos do gráfico
 * @returns Média aritmética em horas
 */
export function resolveWeeklyChartAverage(points: DashboardWeeklyChartPoint[]): number {
  if (points.length === 0) {
    return 0;
  }
  const total = points.reduce((sum, point) => sum + point.hours, 0);
  return Number((total / points.length).toFixed(1));
}

/**
 * Monta lista unificada de colaboradores que precisam de atenção.
 * @param intradayEntries Alertas intradiários
 * @param weeklyEntries Entradas semanais em alerta
 * @param goalEntries Metas com progresso baixo
 * @returns Lista ordenada por severidade (máx. 6 itens)
 */
export function buildAttentionItems(
  intradayEntries: IntradayConcernEntryDto[],
  weeklyEntries: WeeklyInactivityEntryDto[],
  goalEntries: DashboardGoalEntryDto[],
): DashboardAttentionItem[] {
  const items: DashboardAttentionItem[] = [];
  const seen = new Set<string>();

  for (const entry of intradayEntries) {
    const key = entry.trackedUserId || entry.discordId;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const isNotStarted = entry.status === 'not_started';
    items.push({
      id: `intraday-${key}`,
      displayName: entry.displayName,
      message: isNotStarted ? 'Sem colaboração hoje' : 'Colaboração baixa hoje',
      severity: isNotStarted ? 'critical' : 'warning',
      actionLabel: 'Ver ao vivo',
      actionRoute: '/app/live',
    });
  }

  for (const entry of weeklyEntries) {
    const key = entry.trackedUserId ?? entry.discordId ?? entry.displayName;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const days = entry.inactiveBusinessDays ?? 0;
    items.push({
      id: `weekly-${key}`,
      displayName: entry.displayName,
      categoryName: entry.categoryName,
      message:
        entry.status === 'missing'
          ? `Sem colaboração há ${days || 1} dia(s) útil(eis)`
          : 'Baixa colaboração em voz na semana',
      severity: entry.status === 'missing' ? 'critical' : 'warning',
      actionLabel: 'Abrir perfil',
      actionRoute: '/app/reports/member-journey',
      actionQueryParams: entry.trackedUserId ? { trackedUserId: entry.trackedUserId } : undefined,
    });
  }

  for (const entry of goalEntries.filter((item) => item.shouldAlertLowProgress)) {
    const key = entry.trackedUserId || entry.discordId;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    items.push({
      id: `goal-${key}`,
      displayName: entry.displayName,
      categoryName: entry.categoryName,
      message: `Abaixo da meta semanal (${Math.round(entry.progressPercent)}%)`,
      severity: 'warning',
      actionLabel: 'Ver metas',
      actionRoute: '/app/reports/goals',
    });
  }

  const severityWeight: Record<DashboardAttentionItem['severity'], number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  return items
    .sort((left, right) => severityWeight[left.severity] - severityWeight[right.severity])
    .slice(0, 6);
}

/**
 * Gera insights automáticos a partir dos dados carregados no dashboard.
 * @param input Dados agregados da tela
 * @returns Até cinco cards de insight
 */
export function buildDashboardInsights(input: {
  intradayCount: number;
  weeklyConcernCount: number;
  collaboratingCount: number;
  totalTracked: number;
  inVoiceCount: number;
  ptoCount: number;
  topCategoryName?: string;
  topCategoryCollaborationHours?: number;
  concernDisplayName?: string;
  concernInactiveDays?: number;
}): DashboardInsight[] {
  const insights: DashboardInsight[] = [];

  if (input.topCategoryName && input.topCategoryCollaborationHours !== undefined) {
    insights.push({
      id: 'category-leader',
      icon: 'trend-up',
      message: `${input.topCategoryName} liderou colaboração hoje com ${input.topCategoryCollaborationHours}h acumuladas.`,
      tone: 'brand',
    });
  }

  if (input.intradayCount > 0) {
    insights.push({
      id: 'intraday-alert',
      icon: 'alert',
      message: `${input.intradayCount} colaborador(es) sem sinal de colaboração na jornada de hoje.`,
      tone: 'warning',
    });
  }

  if (input.concernDisplayName && input.concernInactiveDays) {
    insights.push({
      id: 'weekly-missing',
      icon: 'alert',
      message: `${input.concernDisplayName} está sem colaboração há ${input.concernInactiveDays} dia(s) útil(eis).`,
      tone: 'error',
    });
  }

  if (input.totalTracked > 0) {
    const onlinePercent = Math.round((input.collaboratingCount / input.totalTracked) * 100);
    insights.push({
      id: 'online-ratio',
      icon: 'users',
      message: `${onlinePercent}% do time rastreado colaborando dentro do esperado.`,
      tone: 'success',
    });
  }

  if (input.inVoiceCount > 0) {
    insights.push({
      id: 'voice-now',
      icon: 'users',
      message: `${input.inVoiceCount} pessoa(s) em voz colaborativa agora.`,
      tone: 'brand',
    });
  }

  if (input.ptoCount > 0) {
    insights.push({
      id: 'pto-today',
      icon: 'calendar',
      message: `${input.ptoCount} colaborador(es) em PTO hoje — não entram nos alertas de inatividade.`,
      tone: 'brand',
    });
  }

  if (input.weeklyConcernCount === 0 && input.intradayCount === 0) {
    insights.push({
      id: 'all-clear',
      icon: 'trend-up',
      message: 'Nenhum alerta ativo no momento. Time dentro dos critérios configurados.',
      tone: 'success',
    });
  }

  return insights.slice(0, 5);
}

/**
 * Decide se o checklist de primeiro valor deve aparecer no dashboard.
 * Exibe quando o onboarding terminou e ainda não há alertas reais de inatividade.
 * @param input Estado mínimo para a decisão
 * @returns true quando o empty-state pós-onboarding deve ser mostrado
 * @example
 * shouldShowFirstValueChecklist({
 *   onboardingComplete: true,
 *   concernEntriesCount: 0,
 *   missingEntriesCount: 0,
 * })
 */
export function shouldShowFirstValueChecklist(input: {
  onboardingComplete: boolean;
  concernEntriesCount: number;
  missingEntriesCount: number;
}): boolean {
  return (
    input.onboardingComplete &&
    input.concernEntriesCount === 0 &&
    input.missingEntriesCount === 0
  );
}

/**
 * Monta o checklist operacional até o primeiro alerta útil de “quem sumiu”.
 * PTO é informativo: não exige ausência cadastrada para marcar como concluído
 * (times sem férias no momento não ficam com checklist eterno pendente).
 * @param input Flags de setup e contexto de jornada
 * @returns Itens com deep links para settings relevantes
 * @example
 * buildFirstValueChecklistItems({
 *   channelsConfigured: true,
 *   calendarConfigured: true,
 *   pushEnabled: false,
 *   isBusinessDay: true,
 * })
 */
export function buildFirstValueChecklistItems(input: {
  channelsConfigured: boolean;
  calendarConfigured: boolean;
  pushEnabled: boolean;
  isBusinessDay: boolean | null;
}): FirstValueChecklistItem[] {
  return [
    {
      id: 'channels',
      title: 'Canais colaborativos',
      description:
        'Confirme quais canais de voz e texto contam como colaboração — assim o Syntra entende o ritmo real do time.',
      actionLabel: 'Revisar canais',
      actionRoute: '/app/settings/channels',
      done: input.channelsConfigured,
    },
    {
      id: 'calendar',
      title: 'Calendário de trabalho',
      description:
        'Jornada e feriados evitam falsos “sumiu” em dias não úteis. Vale conferir se o fuso e a jornada batem com o time.',
      actionLabel: 'Abrir calendário',
      actionRoute: '/app/settings/calendar',
      done: input.calendarConfigured,
    },
    {
      id: 'pto',
      title: 'Ausências planejadas (PTO)',
      description:
        'Quando alguém sair de férias ou folga, cadastre aqui — o alerta de inatividade respeita essas ausências. Não precisa ter PTO agora.',
      actionLabel: 'Abrir ausências',
      actionRoute: '/app/settings/absences',
      done: true,
    },
    {
      id: 'push',
      title: 'Alertas no navegador',
      description:
        'Ative notificações push para saber quando alguém sumir no meio do dia — sem precisar ficar atualizando a tela.',
      actionLabel: 'Configurar alertas',
      actionRoute: '/app/settings/inactivity',
      done: input.pushEnabled,
    },
    {
      id: 'business-day',
      title: 'Aguardar o próximo dia útil',
      description:
        input.isBusinessDay === false
          ? 'Hoje não é dia útil na jornada configurada. Os primeiros alertas de “quem sumiu” surgem nos dias de trabalho do time.'
          : 'Com o setup pronto, os primeiros sinais e alertas aparecem conforme o time colabora no Discord — em geral ainda no primeiro dia útil.',
      actionLabel: 'Ver calendário',
      actionRoute: '/app/settings/calendar',
      done: input.isBusinessDay === true,
    },
  ];
}

/**
 * Conta entradas semanais com status `missing` (quem sumiu).
 * @param entries Entradas do relatório semanal
 * @returns Quantidade de colaboradores missing
 */
export function countWeeklyMissingEntries(entries: WeeklyInactivityEntryDto[]): number {
  return entries.filter((entry) => entry.status === 'missing').length;
}

/**
 * Formata segundos em texto curto (ex.: 1h 20min).
 * @param totalSeconds Duração em segundos
 * @returns Rótulo legível em português
 */
export function formatDashboardDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  }

  return `${minutes}min`;
}

/**
 * Remove formatação Markdown comum de nicknames Discord (ex.: *negrito*).
 * @param displayName Nome exibido bruto
 * @returns Nome legível na UI
 */
export function sanitizeDiscordDisplayName(displayName: string): string {
  return displayName.replace(/\*/g, '').trim();
}

/**
 * Traduz tipo de evento da timeline para texto amigável com origem e destino.
 * @param eventType Tipo bruto do backend (JOIN, LEAVE, SWITCH, etc.)
 * @param displayName Nome do colaborador
 * @param options Canais de origem e destino, quando disponíveis
 * @returns Frase para a timeline do dia
 */
export function formatTimelineEventLabel(
  eventType: string,
  displayName: string,
  options?: { fromChannelName?: string; toChannelName?: string },
): string {
  const name = sanitizeDiscordDisplayName(displayName);
  const from = options?.fromChannelName?.trim();
  const to = options?.toChannelName?.trim();

  switch (eventType) {
    case 'JOIN':
    case 'RECONNECT':
      return `${name} entrou em ${to ?? 'canal de voz'}`;
    case 'LEAVE':
    case 'DISCONNECT':
      return `${name} saiu de ${from ?? 'canal de voz'}`;
    case 'SWITCH':
    case 'MOVED':
      if (from && to) {
        return `${name} foi de ${from} para ${to}`;
      }
      return `${name} mudou para ${to ?? from ?? 'outro canal'}`;
    case 'AFK_AUTO':
      if (from && to) {
        return `${name} foi de ${from} para ${to}`;
      }
      return `${name} foi movido para ${to ?? 'canal AFK/almoço'}`;
    case 'TEXT_ACTIVITY':
      return `${name} iniciou colaboração em texto`;
    default:
      if (from && to) {
        return `${name} foi de ${from} para ${to}`;
      }
      if (to) {
        return `${name} entrou em ${to}`;
      }
      if (from) {
        return `${name} saiu de ${from}`;
      }
      return `${name} registrou atividade colaborativa`;
  }
}
