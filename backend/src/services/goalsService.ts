import { Types } from 'mongoose';
import { CategoryGoalTemplateModel } from '../db/models/CategoryGoalTemplate';
import { MemberCategoryModel } from '../db/models/MemberCategory';
import { TrackedUserModel } from '../db/models/TrackedUser';
import { User } from '../db/models/User';
import { UserCollaborationGoalModel } from '../db/models/UserCollaborationGoal';
import { VoiceSession } from '../db/models/VoiceSession';

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
 * Trunca data para início do dia UTC.
 * @param {Date} value Data de referência
 * @returns {Date} Data no início do dia UTC
 */
function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Retorna início da semana (segunda-feira) em UTC para uma data.
 * @param {Date} value Data de referência
 * @returns {Date} Segunda-feira da semana da data
 */
function startOfUtcWeek(value: Date): Date {
  const day = value.getUTCDay();
  const offsetToMonday = day === 0 ? 6 : day - 1;
  return new Date(startOfUtcDay(value).getTime() - offsetToMonday * 24 * 60 * 60 * 1000);
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
  const periodStart = startOfUtcWeek(referenceDate);
  const periodEnd = startOfUtcDay(referenceDate);

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

  const [goals, realizedRows] = await Promise.all([
    UserCollaborationGoalModel.find({
      organizationId,
      guildId: input.guildId,
      trackedUserId: { $in: trackedUserIds },
    })
      .select({ trackedUserId: 1, weeklyCollaborationHours: 1, dailyMinimumHours: 1 })
      .lean()
      .exec(),
    coreUserIds.length > 0
      ? VoiceSession.aggregate<{ _id: Types.ObjectId; totalSeconds: number }>([
          {
            $match: {
              userId: { $in: coreUserIds },
              startedAt: { $gte: periodStart, $lte: periodEnd },
              durationSeconds: { $gt: 0 },
              isIgnoredChannel: false,
              sessionType: 'VOICE',
            },
          },
          { $group: { _id: '$userId', totalSeconds: { $sum: '$durationSeconds' } } },
        ])
      : Promise.resolve([]),
  ]);

  const goalsByTrackedUserId = new Map(goals.map((goal) => [String(goal.trackedUserId), goal]));
  const realizedHoursByCoreUserId = new Map(
    realizedRows.map((row) => [String(row._id), Number((row.totalSeconds / 3600).toFixed(2))]),
  );

  const entries: GoalWeeklyReportEntry[] = trackedUsers.map((trackedUser) => {
    const goal = goalsByTrackedUserId.get(String(trackedUser._id));
    const coreUserId = coreUserIdByDiscordId.get(trackedUser.discordId);
    const realizedHours = coreUserId ? realizedHoursByCoreUserId.get(String(coreUserId)) ?? 0 : 0;
    const weeklyGoalHours = goal?.weeklyCollaborationHours ?? null;
    const progressPercent = weeklyGoalHours && weeklyGoalHours > 0
      ? Number(Math.min(100, (realizedHours / weeklyGoalHours) * 100).toFixed(2))
      : 0;

    const trackedCategoryId = trackedUser.categoryId as Types.ObjectId | undefined;

    return {
      trackedUserId: trackedUser._id,
      discordId: trackedUser.discordId,
      displayName: trackedUser.displayName,
      categoryId: trackedCategoryId,
      categoryName: trackedCategoryId ? categoryNameById.get(String(trackedCategoryId)) : undefined,
      weeklyGoalHours,
      dailyMinimumHours: goal?.dailyMinimumHours ?? null,
      realizedHours,
      progressPercent,
      shouldAlertLowProgress: weeklyGoalHours ? shouldTriggerLowProgressThursdayAlert(referenceDate, progressPercent) : false,
    };
  });

  return {
    periodStart,
    periodEnd,
    generatedAt: referenceDate,
    entries,
  };
}
