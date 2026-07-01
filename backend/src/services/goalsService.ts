import { Types } from 'mongoose';
import { CategoryGoalTemplateModel } from '../db/models/CategoryGoalTemplate';
import { MemberCategoryModel } from '../db/models/MemberCategory';
import { PlannedAbsenceModel, type IPlannedAbsence } from '../db/models/PlannedAbsence';
import { TrackedUserModel } from '../db/models/TrackedUser';
import { User } from '../db/models/User';
import { UserCollaborationGoalModel } from '../db/models/UserCollaborationGoal';
import { VoiceSession } from '../db/models/VoiceSession';
import { isOnPlannedAbsence } from './plannedAbsenceService';
import {
  countEnabledBusinessDaysInWorkWeek,
  countInclusiveBusinessDaysInPeriod,
  getWorkCalendarForGuild,
} from './workCalendarService';
import type { ReportDatePreset } from '../utils/reportDateRange';
import {
  endOfUtcDay,
  overlapSeconds,
  startOfUtcDay,
  startOfUtcWeek,
} from '../utils/sessionTimeUtils';

/**
 * Payload necessário para aplicar template de categoria em metas individuais.
 */
export interface ApplyCategoryGoalsInput {
  organizationId: string;
  guildId: string;
  categoryId: string;
  setBy: string;
}

/**
 * Resultado de aplicação de template por categoria.
 */
export interface ApplyCategoryGoalsResult {
  matchedTrackedUsers: number;
  appliedCount: number;
}

/**
 * Entrada para consulta de relatório semanal de metas.
 */
export interface GoalsWeeklyReportInput {
  organizationId: string;
  guildId: string;
  categoryId?: string;
  referenceDate?: Date;
  /** Início do intervalo (sobrescreve semana corrente quando informado com `to`) */
  from?: Date;
  /** Fim do intervalo (sobrescreve semana corrente quando informado com `from`) */
  to?: Date;
  /** Instante atual usado para limitar horas realizadas (default: agora). Útil em testes. */
  now?: Date;
  /** Preset do filtro de data — define meta integral (semana) ou rateada (dia/janela parcial) */
  datePreset?: ReportDatePreset;
}

/**
 * Linha individual de meta vs realizado para o relatório semanal.
 */
export interface GoalWeeklyReportEntry {
  trackedUserId: Types.ObjectId;
  discordId: string;
  displayName: string;
  categoryId?: Types.ObjectId;
  categoryName?: string;
  /** Meta do período exibida (semanal integral ou rateada pelos dias úteis do filtro) */
  weeklyGoalHours: number | null;
  dailyMinimumHours: number | null;
  /** Mínimo diário acumulado no período (dailyMinimum × dias úteis efetivos), ou null */
  periodMinimumHours: number | null;
  /** Dias úteis do colaborador no intervalo (calendário − feriados − PTO) */
  businessDaysInPeriod: number;
  realizedHours: number;
  progressPercent: number;
  shouldAlertLowProgress: boolean;
}

/**
 * Estrutura de resposta do relatório semanal de metas.
 */
export interface GoalsWeeklyReport {
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  entries: GoalWeeklyReportEntry[];
}

/**
 * Soma horas colaborativas em voz por usuário core no intervalo (com overlap parcial).
 *
 * Sessões ainda abertas (`endedAt: null`) são contabilizadas apenas até o limite
 * superior da janela (`windowEnd`), que nunca deve estar no futuro. Sem esse limite,
 * uma sessão em andamento seria somada até o fim do dia, inflando as horas realizadas.
 * @param coreUserIds IDs de usuários core
 * @param periodStart Início do período
 * @param windowEnd Fim efetivo da janela (já limitado ao instante atual)
 * @returns Mapa userId → horas realizadas
 */
async function aggregateRealizedVoiceHoursByUserId(
  coreUserIds: Types.ObjectId[],
  organizationId: Types.ObjectId,
  guildId: string,
  periodStart: Date,
  windowEnd: Date,
): Promise<Map<string, number>> {
  if (coreUserIds.length === 0) {
    return new Map();
  }

  const sessions = await VoiceSession.find({
    userId: { $in: coreUserIds },
    organizationId,
    guildId,
    isIgnoredChannel: false,
    sessionType: 'VOICE',
    startedAt: { $lte: windowEnd },
    $or: [{ endedAt: null }, { endedAt: { $gte: periodStart } }],
  })
    .select({ userId: 1, startedAt: 1, endedAt: 1 })
    .lean()
    .exec();

  const totals = new Map<string, number>();
  for (const session of sessions) {
    const userId = String(session.userId);
    const seconds = overlapSeconds(session.startedAt, session.endedAt ?? null, periodStart, windowEnd);
    if (seconds <= 0) {
      continue;
    }
    totals.set(userId, (totals.get(userId) ?? 0) + seconds);
  }

  return new Map(
    Array.from(totals.entries()).map(([userId, seconds]) => [userId, Number((seconds / 3600).toFixed(2))]),
  );
}

/**
 * Carrega ausências planejadas ativas/agendadas por discordId.
 * @param organizationId Organização (tenant) alvo
 * @param guildId Guild alvo
 * @param discordIds Lista de usuários Discord
 * @returns Mapa discordId → ausências
 */
async function loadPlannedAbsencesByDiscordId(
  organizationId: Types.ObjectId,
  guildId: string,
  discordIds: string[],
): Promise<Map<string, IPlannedAbsence[]>> {
  if (discordIds.length === 0) {
    return new Map();
  }

  const absences = await PlannedAbsenceModel.find({
    organizationId,
    guildId,
    discordId: { $in: discordIds },
    status: { $in: ['scheduled', 'active'] },
  })
    .sort({ startDate: 1 })
    .exec();

  const byDiscordId = new Map<string, IPlannedAbsence[]>();
  for (const absence of absences) {
    const current = byDiscordId.get(absence.discordId) ?? [];
    current.push(absence);
    byDiscordId.set(absence.discordId, current);
  }

  return byDiscordId;
}

/**
 * Converte string para ObjectId válido.
 * @param {string} value Valor textual recebido da rota
 * @param {string} label Nome lógico do campo para mensagens de erro
 * @returns {Types.ObjectId} ObjectId pronto para consultas no Mongo
 * @throws {Error} Quando identificador não for um ObjectId válido
 */
function parseObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} inválido`);
  }
  return new Types.ObjectId(value);
}

/**
 * Avalia se deve disparar alerta de progresso baixo na quinta-feira.
 * @param {Date} referenceDate Data de referência do cálculo
 * @param {number} progressPercent Progresso em percentual da meta semanal
 * @returns {boolean} `true` quando for quinta-feira e progresso < 50%
 */
export function shouldTriggerLowProgressThursdayAlert(referenceDate: Date, progressPercent: number): boolean {
  const isThursday = referenceDate.getUTCDay() === 4;
  return isThursday && progressPercent < 50;
}

/**
 * Aplica template de categoria para todos os membros rastreados daquela categoria.
 * @param {ApplyCategoryGoalsInput} input Dados do tenant, guild, categoria e usuário executor
 * @returns {Promise<ApplyCategoryGoalsResult>} Quantidade de membros afetados e metas aplicadas
 * @throws {Error} Quando ids informados forem inválidos ou template não existir
 */
export async function applyCategoryGoalsToTrackedUsers(input: ApplyCategoryGoalsInput): Promise<ApplyCategoryGoalsResult> {
  const organizationId = parseObjectId(input.organizationId, 'organizationId');
  const categoryId = parseObjectId(input.categoryId, 'categoryId');
  const setBy = parseObjectId(input.setBy, 'setBy');

  const template = await CategoryGoalTemplateModel.findOne({
    organizationId,
    guildId: input.guildId,
    categoryId,
  })
    .lean()
    .exec();

  if (!template) {
    throw new Error('Template de meta da categoria não encontrado');
  }

  const trackedUsers = await TrackedUserModel.find({
    organizationId,
    guildId: input.guildId,
    categoryId,
    isActive: true,
  })
    .select({ _id: 1 })
    .lean()
    .exec();

  if (trackedUsers.length === 0) {
    return { matchedTrackedUsers: 0, appliedCount: 0 };
  }

  const operations = trackedUsers.map((trackedUser) => ({
    updateOne: {
      filter: { organizationId, guildId: input.guildId, trackedUserId: trackedUser._id },
      update: {
        $set: {
          weeklyCollaborationHours: template.weeklyCollaborationHours,
          dailyMinimumHours: template.dailyMinimumHours,
          source: 'from_category_template' as const,
          setBy,
        },
        $setOnInsert: {
          organizationId,
          guildId: input.guildId,
          trackedUserId: trackedUser._id,
        },
      },
      upsert: true,
    },
  }));

  const bulkResult = await UserCollaborationGoalModel.bulkWrite(operations, { ordered: false });
  const modifiedCount = bulkResult.modifiedCount ?? 0;
  const upsertedCount = bulkResult.upsertedCount ?? 0;

  return {
    matchedTrackedUsers: trackedUsers.length,
    appliedCount: modifiedCount + upsertedCount,
  };
}

/**
 * Aplica templates salvos para todas as categorias do servidor.
 * @param input Dados do tenant, guild e usuário executor
 * @returns Totais agregados e resultado por categoria
 */
export async function applyAllCategoryGoalsToTrackedUsers(
  input: Omit<ApplyCategoryGoalsInput, 'categoryId'>,
): Promise<{
  totalMatchedTrackedUsers: number;
  totalAppliedCount: number;
  categories: Array<{ categoryId: string; matchedTrackedUsers: number; appliedCount: number }>;
}> {
  const organizationId = parseObjectId(input.organizationId, 'organizationId');
  const templates = await CategoryGoalTemplateModel.find({
    organizationId,
    guildId: input.guildId,
  })
    .select({ categoryId: 1 })
    .lean()
    .exec();

  const categories: Array<{ categoryId: string; matchedTrackedUsers: number; appliedCount: number }> = [];
  let totalMatchedTrackedUsers = 0;
  let totalAppliedCount = 0;

  for (const template of templates) {
    const result = await applyCategoryGoalsToTrackedUsers({
      ...input,
      categoryId: String(template.categoryId),
    });
    categories.push({
      categoryId: String(template.categoryId),
      matchedTrackedUsers: result.matchedTrackedUsers,
      appliedCount: result.appliedCount,
    });
    totalMatchedTrackedUsers += result.matchedTrackedUsers;
    totalAppliedCount += result.appliedCount;
  }

  return {
    totalMatchedTrackedUsers,
    totalAppliedCount,
    categories,
  };
}

/**
 * Indica se a meta exibida deve ser a semanal integral (40h) em vez de rateada pelo período.
 * @param preset Preset do filtro de data do relatório
 * @returns true para esta semana e semana passada
 */
function usesFullWeeklyGoalDisplay(preset: ReportDatePreset): boolean {
  return preset === 'this_week' || preset === 'last_week';
}

/**
 * Resolve horas de meta para exibição e cálculo de progresso conforme o preset.
 * @param configuredWeekly Meta semanal configurada do colaborador
 * @param businessDaysInPeriod Dias úteis efetivos no intervalo
 * @param enabledDaysPerWeek Dias úteis habilitados na jornada semanal
 * @param preset Preset do filtro de data
 * @returns Meta do período em horas, ou null quando indisponível
 */
function resolvePeriodGoalHours(
  configuredWeekly: number | null,
  businessDaysInPeriod: number,
  enabledDaysPerWeek: number,
  preset: ReportDatePreset,
): number | null {
  if (!configuredWeekly || configuredWeekly <= 0) {
    return null;
  }
  if (usesFullWeeklyGoalDisplay(preset)) {
    return configuredWeekly;
  }
  if (businessDaysInPeriod <= 0 || enabledDaysPerWeek <= 0) {
    return null;
  }
  return Number((configuredWeekly * (businessDaysInPeriod / enabledDaysPerWeek)).toFixed(2));
}

/**
 * Monta relatório semanal de metas individuais com progresso por usuário.
 * @param {GoalsWeeklyReportInput} input Filtros de tenant, guild, categoria e data de referência
 * @returns {Promise<GoalsWeeklyReport>} Relatório de meta versus realizado por membro
 * @throws {Error} Quando organizationId/categoryId forem inválidos
 */
export async function getGoalsWeeklyReport(input: GoalsWeeklyReportInput): Promise<GoalsWeeklyReport> {
  const organizationId = parseObjectId(input.organizationId, 'organizationId');
  const categoryId = input.categoryId ? parseObjectId(input.categoryId, 'categoryId') : undefined;
  const referenceDate = input.referenceDate ?? new Date();
  const datePreset: ReportDatePreset =
    input.datePreset ?? (input.from && input.to ? 'custom' : 'this_week');

  let periodStart: Date;
  let periodEnd: Date;

  if (input.from && input.to) {
    periodStart = startOfUtcDay(input.from);
    periodEnd = endOfUtcDay(input.to);
  } else {
    periodStart = startOfUtcWeek(referenceDate);
    periodEnd = endOfUtcDay(referenceDate);
  }

  if (periodStart.getTime() > periodEnd.getTime()) {
    throw new Error('Intervalo inválido: from deve ser anterior ou igual a to');
  }

  // Horas realizadas nunca podem incluir o futuro: limita a janela ao instante atual.
  const now = input.now ?? new Date();
  const realizedWindowEnd = new Date(Math.min(periodEnd.getTime(), now.getTime()));

  const trackedUsers = await TrackedUserModel.find({
    organizationId,
    guildId: input.guildId,
    isActive: true,
    ...(categoryId ? { categoryId } : {}),
  })
    .select({ _id: 1, discordId: 1, displayName: 1, categoryId: 1 })
    .lean()
    .exec();

  if (trackedUsers.length === 0) {
    return { periodStart, periodEnd, generatedAt: referenceDate, entries: [] };
  }

  const categories = await MemberCategoryModel.find({
    organizationId,
    guildId: input.guildId,
  })
    .select({ _id: 1, name: 1 })
    .lean()
    .exec();
  const categoryNameById = new Map(categories.map((category) => [String(category._id), category.name]));

  const trackedUserIds = trackedUsers.map((trackedUser) => trackedUser._id);
  const discordIds = trackedUsers.map((trackedUser) => trackedUser.discordId);
  const coreUsers = await User.find({ discordId: { $in: discordIds } })
    .select({ _id: 1, discordId: 1 })
    .lean()
    .exec();
  const coreUserIdByDiscordId = new Map(coreUsers.map((user) => [user.discordId, user._id as Types.ObjectId]));
  const coreUserIds = coreUsers.map((user) => user._id as Types.ObjectId);

  const [goals, realizedHoursByCoreUserId, calendar, plannedAbsencesByDiscordId] = await Promise.all([
    UserCollaborationGoalModel.find({
      organizationId,
      guildId: input.guildId,
      trackedUserId: { $in: trackedUserIds },
    })
      .select({ trackedUserId: 1, weeklyCollaborationHours: 1, dailyMinimumHours: 1 })
      .lean()
      .exec(),
    aggregateRealizedVoiceHoursByUserId(coreUserIds, organizationId, input.guildId, periodStart, realizedWindowEnd),
    getWorkCalendarForGuild(organizationId, input.guildId),
    loadPlannedAbsencesByDiscordId(organizationId, input.guildId, discordIds),
  ]);

  const goalsByTrackedUserId = new Map(goals.map((goal) => [String(goal.trackedUserId), goal]));
  const enabledDaysPerWeek = countEnabledBusinessDaysInWorkWeek(calendar.workWeek);

  const entries: GoalWeeklyReportEntry[] = trackedUsers.map((trackedUser) => {
    const goal = goalsByTrackedUserId.get(String(trackedUser._id));
    const coreUserId = coreUserIdByDiscordId.get(trackedUser.discordId);
    const realizedHours = coreUserId ? realizedHoursByCoreUserId.get(String(coreUserId)) ?? 0 : 0;
    const configuredWeeklyGoal = goal?.weeklyCollaborationHours ?? null;
    const dailyMinimum = goal?.dailyMinimumHours ?? null;
    const userAbsences = plannedAbsencesByDiscordId.get(trackedUser.discordId) ?? [];

    const businessDaysInPeriod = countInclusiveBusinessDaysInPeriod(
      calendar,
      periodStart,
      periodEnd,
      (date) => isOnPlannedAbsence(userAbsences, date),
    );

    const periodMinimumHours =
      dailyMinimum && dailyMinimum > 0 && businessDaysInPeriod > 0
        ? Number((dailyMinimum * businessDaysInPeriod).toFixed(2))
        : null;

    const periodGoalHours = resolvePeriodGoalHours(
      configuredWeeklyGoal,
      businessDaysInPeriod,
      enabledDaysPerWeek,
      datePreset,
    );

    const progressPercent =
      periodGoalHours && periodGoalHours > 0
        ? Number(((realizedHours / periodGoalHours) * 100).toFixed(2))
        : 0;

    const trackedCategoryId = trackedUser.categoryId as Types.ObjectId | undefined;

    return {
      trackedUserId: trackedUser._id,
      discordId: trackedUser.discordId,
      displayName: trackedUser.displayName,
      categoryId: trackedCategoryId,
      categoryName: trackedCategoryId ? categoryNameById.get(String(trackedCategoryId)) : undefined,
      weeklyGoalHours: periodGoalHours,
      dailyMinimumHours: dailyMinimum,
      periodMinimumHours,
      businessDaysInPeriod,
      realizedHours,
      progressPercent,
      shouldAlertLowProgress: periodGoalHours
        ? shouldTriggerLowProgressThursdayAlert(referenceDate, progressPercent)
        : false,
    };
  });

  return {
    periodStart,
    periodEnd,
    generatedAt: referenceDate,
    entries,
  };
}
