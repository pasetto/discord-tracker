import { Types } from 'mongoose';
import {
  GamificationSettingsModel,
  type IGamificationRankingSettings,
  type RankingMetric,
  type RankingPeriod,
  type RankingVisibility,
} from '../db/models/GamificationSettings';
import { PresenceSession } from '../db/models/PresenceSession';
import { TrackedUserModel } from '../db/models/TrackedUser';
import { User } from '../db/models/User';
import { VoiceSession } from '../db/models/VoiceSession';
import { PlatformUserModel } from '../db/models/PlatformUser';
import { getOrganizationPlanContext, type GamificationPlanFeatures } from './gamificationService';
import {
  endOfUtcDay,
  overlapSeconds,
  startOfUtcDay,
  startOfUtcMonth,
  startOfUtcWeek,
} from '../utils/sessionTimeUtils';

/** Papéis que enxergam o ranking completo independente da visibilidade configurada. */
const MANAGER_ROLES = new Set(['owner', 'admin', 'manager']);

/** Status de presença contabilizados como tempo online. */
const ONLINE_PRESENCE_STATUSES = new Set(['ONLINE', 'IDLE', 'DND']);

/**
 * Entrada para geração do ranking gamificado.
 */
export interface GamificationRankingReportInput {
  organizationId: string;
  guildId: string;
  viewerPlatformUserId?: string;
  viewerRole?: string;
  referenceDate?: Date;
}

/**
 * Linha do ranking gamificado para a API.
 */
export interface GamificationRankingEntryDto {
  position: number;
  discordId: string;
  displayName: string;
  isViewer: boolean;
  metricValue: number;
  metricLabel: string;
  productiveHours: number;
  voiceHours: number;
  onlineHours: number;
  collaborationScore: number;
}

/**
 * Relatório de ranking respeitando configuração de gamificação.
 */
export interface GamificationRankingReportDto {
  available: boolean;
  reason?: string;
  period: RankingPeriod;
  periodStart: string;
  periodEnd: string;
  metric: RankingMetric;
  visibility: RankingVisibility;
  anonymousMode: boolean;
  showExactHours: boolean;
  generatedAt: string;
  entries: GamificationRankingEntryDto[];
  viewerPosition?: number;
}

/**
 * Métricas brutas por colaborador antes da ordenação.
 */
interface MemberMetricRow {
  discordId: string;
  displayName: string;
  productiveHours: number;
  voiceHours: number;
  onlineHours: number;
  collaborationScore: number;
}

/**
 * Converte string para ObjectId válido.
 * @param value Valor textual
 * @param label Nome do campo para erro
 * @returns ObjectId parseado
 */
function parseObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} inválido`);
  }
  return new Types.ObjectId(value);
}

/**
 * Resolve janela temporal do ranking conforme período configurado.
 * @param period Período diário, semanal ou mensal
 * @param referenceDate Data de referência
 * @returns Início e fim do período em UTC
 */
function resolvePeriodBounds(period: RankingPeriod, referenceDate: Date): { start: Date; end: Date } {
  const end = endOfUtcDay(referenceDate);
  if (period === 'daily') {
    return { start: startOfUtcDay(referenceDate), end };
  }
  if (period === 'weekly') {
    return { start: startOfUtcWeek(referenceDate), end };
  }
  return { start: startOfUtcMonth(referenceDate), end };
}

/**
 * Calcula score composto de colaboração (0–100) normalizado pelo máximo do grupo.
 * @param productiveHours Horas colaborativas
 * @param voiceHours Horas em voz
 * @param onlineHours Horas online
 * @returns Score bruto ponderado
 */
function rawCollaborationScore(productiveHours: number, voiceHours: number, onlineHours: number): number {
  return productiveHours * 0.6 + voiceHours * 0.3 + onlineHours * 0.1;
}

/**
 * Formata valor da métrica principal para exibição.
 * @param metric Métrica configurada
 * @param row Linha com métricas do membro
 * @param showExactHours Exibir horas com decimais
 * @returns Texto formatado
 */
function formatMetricLabel(metric: RankingMetric, row: MemberMetricRow, showExactHours: boolean): string {
  if (metric === 'collaboration_score') {
    return `${row.collaborationScore.toFixed(0)} pts`;
  }

  const hours =
    metric === 'voice_hours' ? row.voiceHours : metric === 'online_hours' ? row.onlineHours : row.productiveHours;

  return showExactHours ? `${hours.toFixed(1)} h` : `${Math.round(hours)} h`;
}

/**
 * Valor numérico usado para ordenação conforme métrica configurada.
 * @param metric Métrica do ranking
 * @param row Linha do colaborador
 * @returns Valor para sort descendente
 */
function metricSortValue(metric: RankingMetric, row: MemberMetricRow): number {
  if (metric === 'voice_hours') {
    return row.voiceHours;
  }
  if (metric === 'online_hours') {
    return row.onlineHours;
  }
  if (metric === 'collaboration_score') {
    return row.collaborationScore;
  }
  return row.productiveHours;
}

/**
 * Aplica modo anônimo mascarando nomes fora do próprio usuário.
 * @param entry Linha do ranking
 * @param anonymousMode Flag de anonimato
 * @returns Linha com displayName possivelmente mascarado
 */
function applyAnonymousDisplay(
  entry: GamificationRankingEntryDto,
  anonymousMode: boolean,
): GamificationRankingEntryDto {
  if (!anonymousMode || entry.isViewer) {
    return entry;
  }
  return {
    ...entry,
    displayName: `Colaborador #${entry.position}`,
  };
}

/**
 * Filtra entradas conforme visibilidade e papel do visualizador.
 * @param entries Lista completa ordenada
 * @param settings Configuração de ranking
 * @param viewerDiscordId Discord ID do visualizador
 * @param viewerRole Papel na organização
 * @returns Subconjunto visível
 */
function filterByVisibility(
  entries: GamificationRankingEntryDto[],
  settings: IGamificationRankingSettings,
  viewerDiscordId: string | undefined,
  viewerRole: string | undefined,
): GamificationRankingEntryDto[] {
  if (viewerRole && MANAGER_ROLES.has(viewerRole)) {
    return entries;
  }

  if (settings.visibility === 'guild') {
    return entries;
  }

  if (settings.visibility === 'private') {
    if (!viewerDiscordId) {
      return [];
    }
    return entries.filter((entry) => entry.discordId === viewerDiscordId);
  }

  // team: membros das equipes em que o visualizador participa
  const viewerTeams = settings.teams.filter((team) => team.memberDiscordIds.includes(viewerDiscordId ?? ''));
  const allowedDiscordIds = new Set(viewerTeams.flatMap((team) => team.memberDiscordIds));
  if (allowedDiscordIds.size === 0 && viewerDiscordId) {
    allowedDiscordIds.add(viewerDiscordId);
  }
  return entries.filter((entry) => allowedDiscordIds.has(entry.discordId));
}

/**
 * Agrega horas online por usuário no período com sobreposição temporal.
 * @param coreUserIds IDs Mongo dos usuários core
 * @param organizationId Organização tenant
 * @param guildId Guild monitorada
 * @param periodStart Início do período
 * @param periodEnd Fim do período
 * @returns Mapa userId → horas online
 */
async function aggregateOnlineHoursByUser(
  coreUserIds: Types.ObjectId[],
  organizationId: Types.ObjectId,
  guildId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<Map<string, number>> {
  if (coreUserIds.length === 0) {
    return new Map();
  }

  const sessions = await PresenceSession.find({
    userId: { $in: coreUserIds },
    organizationId,
    guildId,
    startedAt: { $lte: periodEnd },
    $or: [{ endedAt: null }, { endedAt: { $gte: periodStart } }],
    status: { $in: Array.from(ONLINE_PRESENCE_STATUSES) },
  })
    .select({ userId: 1, status: 1, startedAt: 1, endedAt: 1 })
    .lean()
    .exec();

  const totals = new Map<string, number>();
  for (const session of sessions) {
    const seconds = overlapSeconds(session.startedAt, session.endedAt, periodStart, periodEnd);
    if (seconds <= 0) {
      continue;
    }
    const key = String(session.userId);
    totals.set(key, (totals.get(key) ?? 0) + seconds);
  }

  return new Map(
    Array.from(totals.entries()).map(([userId, seconds]) => [userId, Number((seconds / 3600).toFixed(2))]),
  );
}

/**
 * Agrega horas de voz (produtivas e totais) por usuário no período.
 * @param coreUserIds IDs Mongo
 * @param organizationId Organização tenant
 * @param guildId Guild monitorada
 * @param periodStart Início
 * @param periodEnd Fim
 * @param includedChannelIds Filtro opcional de canais
 * @returns Mapas de horas produtivas e totais em voz
 */
async function aggregateVoiceHoursByUser(
  coreUserIds: Types.ObjectId[],
  organizationId: Types.ObjectId,
  guildId: string,
  periodStart: Date,
  periodEnd: Date,
  includedChannelIds: string[],
): Promise<{ productive: Map<string, number>; voice: Map<string, number> }> {
  if (coreUserIds.length === 0) {
    return { productive: new Map(), voice: new Map() };
  }

  const match: Record<string, unknown> = {
    userId: { $in: coreUserIds },
    organizationId,
    guildId,
    startedAt: { $gte: periodStart, $lte: periodEnd },
    durationSeconds: { $gt: 0 },
    sessionType: 'VOICE',
  };

  if (includedChannelIds.length > 0) {
    match.channelId = { $in: includedChannelIds };
  }

  const rows = await VoiceSession.aggregate<{ _id: Types.ObjectId; productiveSeconds: number; voiceSeconds: number }>([
    { $match: match },
    {
      $group: {
        _id: '$userId',
        productiveSeconds: {
          $sum: {
            $cond: [{ $eq: ['$isIgnoredChannel', false] }, '$durationSeconds', 0],
          },
        },
        voiceSeconds: { $sum: '$durationSeconds' },
      },
    },
  ]);

  const productive = new Map(
    rows.map((row) => [String(row._id), Number((row.productiveSeconds / 3600).toFixed(2))]),
  );
  const voice = new Map(rows.map((row) => [String(row._id), Number((row.voiceSeconds / 3600).toFixed(2))]));
  return { productive, voice };
}

/**
 * Monta relatório de ranking gamificado para uma guild.
 * @param input Tenant, guild e contexto do visualizador
 * @returns Ranking configurado ou estado indisponível com motivo
 */
export async function getGamificationRankingReport(
  input: GamificationRankingReportInput,
): Promise<GamificationRankingReportDto> {
  const organizationId = parseObjectId(input.organizationId, 'organizationId');
  const referenceDate = input.referenceDate ?? new Date();
  const generatedAt = referenceDate.toISOString();

  let planFeatures: GamificationPlanFeatures;
  try {
    const planContext = await getOrganizationPlanContext(organizationId);
    planFeatures = {
      gamification: planContext.gamification,
      ranking: planContext.ranking,
    };
  } catch (error) {
    return {
      available: false,
      reason: (error as Error).message,
      period: 'weekly',
      periodStart: generatedAt,
      periodEnd: generatedAt,
      metric: 'productive_hours',
      visibility: 'private',
      anonymousMode: false,
      showExactHours: true,
      generatedAt,
      entries: [],
    };
  }

  const settings =
    (await GamificationSettingsModel.findOne({ organizationId, guildId: input.guildId }).lean().exec()) ?? null;

  const ranking = settings?.ranking;
  const period = ranking?.period ?? 'weekly';
  const metric = ranking?.metric ?? 'productive_hours';
  const visibility = ranking?.visibility ?? 'private';
  const anonymousMode = ranking?.anonymousMode ?? false;
  const showExactHours = ranking?.showExactHours ?? true;
  const topCount = Math.min(Math.max(ranking?.topCount ?? 10, 1), 50);
  const { start: periodStart, end: periodEnd } = resolvePeriodBounds(period, referenceDate);

  const unavailable = (reason: string): GamificationRankingReportDto => ({
    available: false,
    reason,
    period,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    metric,
    visibility,
    anonymousMode,
    showExactHours,
    generatedAt,
    entries: [],
  });

  if (!planFeatures.gamification) {
    return unavailable('Gamificação não está disponível no plano atual');
  }
  if (!planFeatures.ranking) {
    return unavailable('Ranking não está disponível no plano atual');
  }
  if (!settings?.enabled) {
    return unavailable('Gamificação não está habilitada para este servidor');
  }
  if (!settings.ranking.enabled) {
    return unavailable('Ranking não está habilitado nas configurações de gamificação');
  }

  const trackedUsers = await TrackedUserModel.find({ organizationId, guildId: input.guildId, isActive: true })
    .select({ discordId: 1, displayName: 1 })
    .lean()
    .exec();

  if (trackedUsers.length === 0) {
    return {
      available: true,
      period,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      metric,
      visibility,
      anonymousMode,
      showExactHours,
      generatedAt,
      entries: [],
    };
  }

  const discordIds = trackedUsers.map((user) => user.discordId);
  const coreUsers = await User.find({ discordId: { $in: discordIds } })
    .select({ _id: 1, discordId: 1 })
    .lean()
    .exec();
  const coreUserIdByDiscordId = new Map(coreUsers.map((user) => [user.discordId, user._id as Types.ObjectId]));
  const coreUserIds = coreUsers.map((user) => user._id as Types.ObjectId);

  const includedChannelIds = settings.ranking.includedChannelIds ?? [];
  const [{ productive, voice }, onlineHoursByUserId] = await Promise.all([
    aggregateVoiceHoursByUser(coreUserIds, organizationId, input.guildId, periodStart, periodEnd, includedChannelIds),
    aggregateOnlineHoursByUser(coreUserIds, organizationId, input.guildId, periodStart, periodEnd),
  ]);

  const metricRows: MemberMetricRow[] = trackedUsers.map((trackedUser) => {
    const coreUserId = coreUserIdByDiscordId.get(trackedUser.discordId);
    const coreKey = coreUserId ? String(coreUserId) : '';
    const productiveHours = coreKey ? productive.get(coreKey) ?? 0 : 0;
    const voiceHours = coreKey ? voice.get(coreKey) ?? 0 : 0;
    const onlineHours = coreKey ? onlineHoursByUserId.get(coreKey) ?? 0 : 0;
    const rawScore = rawCollaborationScore(productiveHours, voiceHours, onlineHours);
    return {
      discordId: trackedUser.discordId,
      displayName: trackedUser.displayName,
      productiveHours,
      voiceHours,
      onlineHours,
      collaborationScore: rawScore,
    };
  });

  const maxRawScore = Math.max(...metricRows.map((row) => rawCollaborationScore(row.productiveHours, row.voiceHours, row.onlineHours)), 0);
  const rowsWithScore = metricRows.map((row) => ({
    ...row,
    collaborationScore:
      maxRawScore > 0
        ? Number(((rawCollaborationScore(row.productiveHours, row.voiceHours, row.onlineHours) / maxRawScore) * 100).toFixed(1))
        : 0,
  }));

  const sorted = [...rowsWithScore].sort((left, right) => {
    const diff = metricSortValue(metric, right) - metricSortValue(metric, left);
    if (diff !== 0) {
      return diff;
    }
    return left.displayName.localeCompare(right.displayName, 'pt-BR');
  });

  let viewerDiscordId: string | undefined;
  if (input.viewerPlatformUserId && Types.ObjectId.isValid(input.viewerPlatformUserId)) {
    const platformUser = await PlatformUserModel.findById(input.viewerPlatformUserId)
      .select({ discordId: 1 })
      .lean()
      .exec();
    viewerDiscordId = platformUser?.discordId;
  }

  const allEntries: GamificationRankingEntryDto[] = sorted.map((row, index) => {
    const position = index + 1;
    return {
      position,
      discordId: row.discordId,
      displayName: row.displayName,
      isViewer: Boolean(viewerDiscordId && row.discordId === viewerDiscordId),
      metricValue: Number(metricSortValue(metric, row).toFixed(2)),
      metricLabel: formatMetricLabel(metric, row, showExactHours),
      productiveHours: row.productiveHours,
      voiceHours: row.voiceHours,
      onlineHours: row.onlineHours,
      collaborationScore: row.collaborationScore,
    };
  });

  const topEntries = allEntries.slice(0, topCount);
  const visibleEntries = filterByVisibility(topEntries, settings.ranking, viewerDiscordId, input.viewerRole).map(
    (entry) => applyAnonymousDisplay(entry, anonymousMode),
  );

  let finalEntries = visibleEntries;
  if (
    settings.ranking.visibility === 'private' &&
    viewerDiscordId &&
    !visibleEntries.some((entry) => entry.discordId === viewerDiscordId)
  ) {
    const viewerEntry = allEntries.find((entry) => entry.discordId === viewerDiscordId);
    if (viewerEntry) {
      finalEntries = [applyAnonymousDisplay({ ...viewerEntry, isViewer: true }, anonymousMode)];
    }
  }

  const viewerPosition = viewerDiscordId
    ? allEntries.find((entry) => entry.discordId === viewerDiscordId)?.position
    : undefined;

  return {
    available: true,
    period,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    metric,
    visibility,
    anonymousMode,
    showExactHours,
    generatedAt,
    entries: finalEntries,
    viewerPosition,
  };
}
