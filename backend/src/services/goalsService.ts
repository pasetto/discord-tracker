import { Types } from 'mongoose';
import { CategoryGoalTemplateModel } from '../db/models/CategoryGoalTemplate';
import { MemberCategoryModel } from '../db/models/MemberCategory';
import { TrackedUserModel } from '../db/models/TrackedUser';
import { User } from '../db/models/User';
import { UserCollaborationGoalModel } from '../db/models/UserCollaborationGoal';
import { VoiceSession } from '../db/models/VoiceSession';
import {
  countInclusiveUtcDays,
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
  weeklyGoalHours: number | null;
  dailyMinimumHours: number | null;
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
  periodStart: Date,
  windowEnd: Date,
): Promise<Map<string, number>> {
  if (coreUserIds.length === 0) {
    return new Map();
  }

  const sessions = await VoiceSession.find({
    userId: { $in: coreUserIds },
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
 * Calcula meta proporcional ao número de dias do intervalo selecionado.
 * @param weeklyGoalHours Meta semanal configurada
 * @param periodStart Início do período
 * @param periodEnd Fim do período
 * @returns Meta ajustada ao intervalo ou null
 */
function prorateWeeklyGoalHours(
  weeklyGoalHours: number | null | undefined,
  periodStart: Date,
  periodEnd: Date,
): number | null {
  if (!weeklyGoalHours || weeklyGoalHours <= 0) {
    return null;
  }

  const days = countInclusiveUtcDays(periodStart, periodEnd);
  return Number(((weeklyGoalHours * days) / 7).toFixed(2));
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
 * Monta relatório semanal de metas individuais com progresso por usuário.
 * @param {GoalsWeeklyReportInput} input Filtros de tenant, guild, categoria e data de referência
 * @returns {Promise<GoalsWeeklyReport>} Relatório de meta versus realizado por membro
 * @throws {Error} Quando organizationId/categoryId forem inválidos
 */
export async function getGoalsWeeklyReport(input: GoalsWeeklyReportInput): Promise<GoalsWeeklyReport> {
  const organizationId = parseObjectId(input.organizationId, 'organizationId');
  const categoryId = input.categoryId ? parseObjectId(input.categoryId, 'categoryId') : undefined;
  const referenceDate = input.referenceDate ?? new Date();

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

  const [goals, realizedHoursByCoreUserId] = await Promise.all([
    UserCollaborationGoalModel.find({
      organizationId,
      guildId: input.guildId,
      trackedUserId: { $in: trackedUserIds },
    })
      .select({ trackedUserId: 1, weeklyCollaborationHours: 1, dailyMinimumHours: 1 })
      .lean()
      .exec(),
    aggregateRealizedVoiceHoursByUserId(coreUserIds, periodStart, realizedWindowEnd),
  ]);

  const goalsByTrackedUserId = new Map(goals.map((goal) => [String(goal.trackedUserId), goal]));

  const entries: GoalWeeklyReportEntry[] = trackedUsers.map((trackedUser) => {
    const goal = goalsByTrackedUserId.get(String(trackedUser._id));
    const coreUserId = coreUserIdByDiscordId.get(trackedUser.discordId);
    const realizedHours = coreUserId ? realizedHoursByCoreUserId.get(String(coreUserId)) ?? 0 : 0;
    const weeklyGoalHours = goal?.weeklyCollaborationHours ?? null;
    const periodGoalHours = prorateWeeklyGoalHours(weeklyGoalHours, periodStart, periodEnd);
    const progressPercent = periodGoalHours && periodGoalHours > 0
      ? Number(Math.min(100, (realizedHours / periodGoalHours) * 100).toFixed(2))
      : 0;

    const trackedCategoryId = trackedUser.categoryId as Types.ObjectId | undefined;

    return {
      trackedUserId: trackedUser._id,
      discordId: trackedUser.discordId,
      displayName: trackedUser.displayName,
      categoryId: trackedCategoryId,
      categoryName: trackedCategoryId ? categoryNameById.get(String(trackedCategoryId)) : undefined,
      weeklyGoalHours: periodGoalHours,
      dailyMinimumHours: goal?.dailyMinimumHours ?? null,
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
