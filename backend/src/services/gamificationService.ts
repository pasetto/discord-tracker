import { Types } from 'mongoose';
import { GamificationSettingsModel, type IGamificationSettings } from '../db/models/GamificationSettings';
import { OrganizationModel } from '../db/models/Organization';
import { PlanModel } from '../db/models/Plan';

/**
 * Recursos de plano relevantes para gamificação.
 */
export interface GamificationPlanFeatures {
  gamification: boolean;
  ranking: boolean;
}

/**
 * Metadados do plano ativo da organização.
 */
export interface GamificationPlanInfo {
  name: string;
  slug: string;
}

/**
 * Resultado de leitura das configurações de gamificação.
 */
export interface GamificationSettingsResult {
  settings: IGamificationSettings;
  planFeatures: GamificationPlanFeatures;
  plan: GamificationPlanInfo;
}

/**
 * Entrada para leitura das configurações por tenant/guild.
 */
export interface GetGamificationSettingsInput {
  organizationId: string;
  guildId: string;
}

/**
 * Patch parcial aceito para atualização de gamificação.
 */
export interface GamificationSettingsPatch {
  enabled?: boolean;
  ranking?: Partial<IGamificationSettings['ranking']>;
  badges?: Partial<IGamificationSettings['badges']>;
  streaks?: Partial<IGamificationSettings['streaks']>;
  teamGoals?: Partial<IGamificationSettings['teamGoals']>;
}

/**
 * Entrada para atualização de configurações de gamificação.
 */
export interface UpsertGamificationSettingsInput extends GetGamificationSettingsInput {
  updatedBy: string;
  patch: GamificationSettingsPatch;
}

/**
 * Erro semântico para recurso bloqueado por plano.
 */
export class PlanFeatureNotAvailableError extends Error {
  /**
   * Inicializa erro de feature desabilitada no plano.
   * @param {'gamification' | 'ranking'} feature Recurso bloqueado
   * @returns {void} Não retorna valor
   */
  constructor(feature: 'gamification' | 'ranking') {
    const message =
      feature === 'gamification'
        ? 'Gamificação não está disponível para o plano atual'
        : 'Ranking não está disponível para o plano atual';
    super(message);
    this.name = 'PlanFeatureNotAvailableError';
  }
}

/**
 * Converte string para ObjectId válido.
 * @param {string} value Valor textual recebido da API
 * @param {string} label Nome lógico para mensagem de erro
 * @returns {Types.ObjectId} ObjectId pronto para consultas
 * @throws {Error} Quando valor não for ObjectId válido
 */
function parseObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} inválido`);
  }
  return new Types.ObjectId(value);
}

/**
 * Resolve features e metadados do plano ativo da organização.
 * @param {Types.ObjectId} organizationId Organização que está sendo consultada
 * @returns Flags de recurso e identificação do plano
 * @throws {Error} Quando organização/plano não existir
 */
async function getOrganizationPlanContext(
  organizationId: Types.ObjectId,
): Promise<GamificationPlanFeatures & GamificationPlanInfo> {
  const organization = await OrganizationModel.findById(organizationId)
    .select({ 'subscription.planId': 1 })
    .lean()
    .exec();

  if (!organization?.subscription?.planId) {
    throw new Error('Assinatura da organização não encontrada');
  }

  const plan = await PlanModel.findById(organization.subscription.planId)
    .select({ name: 1, slug: 1, 'features.gamification': 1, 'features.ranking': 1 })
    .lean()
    .exec();

  if (!plan?.features) {
    throw new Error('Plano da organização não encontrado');
  }

  return {
    name: plan.name,
    slug: plan.slug,
    gamification: Boolean(plan.features.gamification),
    ranking: Boolean(plan.features.ranking),
  };
}

/**
 * Gera defaults de gamificação para uma guild.
 * @param {Types.ObjectId} organizationId Organização da configuração
 * @param {string} guildId Guild do Discord
 * @param {Types.ObjectId} updatedBy Usuário responsável pelo snapshot inicial
 * @returns {Pick<IGamificationSettings, 'organizationId' | 'guildId' | 'enabled' | 'ranking' | 'badges' | 'streaks' | 'teamGoals' | 'updatedBy'>} Defaults de configuração
 */
function createDefaultSettings(
  organizationId: Types.ObjectId,
  guildId: string,
  updatedBy: Types.ObjectId,
): Pick<
  IGamificationSettings,
  'organizationId' | 'guildId' | 'enabled' | 'ranking' | 'badges' | 'streaks' | 'teamGoals' | 'updatedBy'
> {
  return {
    organizationId,
    guildId,
    enabled: false,
    ranking: {
      enabled: false,
      visibility: 'private',
      metric: 'productive_hours',
      period: 'weekly',
      topCount: 10,
      showExactHours: true,
      anonymousMode: false,
      excludedRoleIds: [],
      includedChannelIds: [],
      teams: [],
    },
    badges: {
      enabled: false,
      presetPack: 'minimal',
    },
    streaks: {
      enabled: false,
      minProductiveHoursPerDay: 1,
    },
    teamGoals: {
      enabled: false,
    },
    updatedBy,
  };
}

/**
 * Converte subdocumento Mongoose em objeto plano para merge seguro.
 * @param value Valor possivelmente hidratado pelo Mongoose
 * @returns Objeto plano serializável
 */
function toPlainSubdocument<T extends Record<string, unknown>>(value: T): T {
  if (value && typeof value === 'object' && 'toObject' in value && typeof value.toObject === 'function') {
    return value.toObject() as T;
  }
  return { ...value };
}

/**
 * Aplica merge controlado de patch parcial sobre documento base.
 * @param {IGamificationSettings} base Documento base atual
 * @param {UpsertGamificationSettingsInput['patch']} patch Alterações parciais recebidas da API
 * @returns {Pick<IGamificationSettings, 'enabled' | 'ranking' | 'badges' | 'streaks' | 'teamGoals'>} Bloco final pronto para persistência
 */
function mergeSettingsPatch(
  base: IGamificationSettings,
  patch: GamificationSettingsPatch,
): Pick<IGamificationSettings, 'enabled' | 'ranking' | 'badges' | 'streaks' | 'teamGoals'> {
  const baseRanking = toPlainSubdocument(base.ranking as unknown as Record<string, unknown>);
  const baseBadges = toPlainSubdocument(base.badges as unknown as Record<string, unknown>);
  const baseStreaks = toPlainSubdocument(base.streaks as unknown as Record<string, unknown>);
  const baseTeamGoals = toPlainSubdocument(base.teamGoals as unknown as Record<string, unknown>);

  return {
    enabled: patch.enabled ?? base.enabled,
    ranking: {
      ...baseRanking,
      ...(patch.ranking ?? {}),
    } as IGamificationSettings['ranking'],
    badges: {
      ...baseBadges,
      ...(patch.badges ?? {}),
    } as IGamificationSettings['badges'],
    streaks: {
      ...baseStreaks,
      ...(patch.streaks ?? {}),
    } as IGamificationSettings['streaks'],
    teamGoals: {
      ...baseTeamGoals,
      ...(patch.teamGoals ?? {}),
    } as IGamificationSettings['teamGoals'],
  };
}

/**
 * Garante que o plano habilita gamificação.
 * @param {GamificationPlanFeatures} features Features do plano ativo
 * @returns {void} Não retorna valor
 * @throws {PlanFeatureNotAvailableError} Quando gamification estiver desabilitado
 */
function enforceGamificationFeature(features: GamificationPlanFeatures): void {
  if (!features.gamification) {
    throw new PlanFeatureNotAvailableError('gamification');
  }
}

/**
 * Garante que ranking não seja habilitado quando bloqueado no plano.
 * @param {GamificationPlanFeatures} features Features do plano ativo
 * @param {Pick<IGamificationSettings, 'ranking'>} settings Configuração consolidada
 * @returns {void} Não retorna valor
 * @throws {PlanFeatureNotAvailableError} Quando ranking.enabled for true sem permissão de plano
 */
function enforceRankingFeature(features: GamificationPlanFeatures, settings: Pick<IGamificationSettings, 'ranking'>): void {
  if (settings.ranking.enabled && !features.ranking) {
    throw new PlanFeatureNotAvailableError('ranking');
  }
}

/**
 * Retorna a configuração de gamificação por guild com enforcement de plano.
 * @param {GetGamificationSettingsInput} input Tenant e guild alvo da consulta
 * @returns {Promise<GamificationSettingsResult>} Configuração atual e flags do plano
 */
export async function getGamificationSettings(input: GetGamificationSettingsInput): Promise<GamificationSettingsResult> {
  const organizationId = parseObjectId(input.organizationId, 'organizationId');
  const planContext = await getOrganizationPlanContext(organizationId);
  const planFeatures: GamificationPlanFeatures = {
    gamification: planContext.gamification,
    ranking: planContext.ranking,
  };
  enforceGamificationFeature(planFeatures);

  const settings =
    (await GamificationSettingsModel.findOne({
      organizationId,
      guildId: input.guildId,
    }).exec()) ??
    new GamificationSettingsModel(createDefaultSettings(organizationId, input.guildId, organizationId));

  enforceRankingFeature(planFeatures, settings);

  return {
    settings,
    planFeatures,
    plan: { name: planContext.name, slug: planContext.slug },
  };
}

/**
 * Cria ou atualiza configuração de gamificação por guild com validações de plano.
 * @param {UpsertGamificationSettingsInput} input Tenant, guild, usuário e patch de atualização
 * @returns {Promise<GamificationSettingsResult>} Configuração persistida e flags do plano
 */
export async function upsertGamificationSettings(input: UpsertGamificationSettingsInput): Promise<GamificationSettingsResult> {
  const organizationId = parseObjectId(input.organizationId, 'organizationId');
  const updatedBy = parseObjectId(input.updatedBy, 'updatedBy');
  const planContext = await getOrganizationPlanContext(organizationId);
  const planFeatures: GamificationPlanFeatures = {
    gamification: planContext.gamification,
    ranking: planContext.ranking,
  };
  enforceGamificationFeature(planFeatures);

  const currentSettings =
    (await GamificationSettingsModel.findOne({
      organizationId,
      guildId: input.guildId,
    }).exec()) ??
    new GamificationSettingsModel(createDefaultSettings(organizationId, input.guildId, updatedBy));

  const mergedSettings = mergeSettingsPatch(currentSettings, input.patch);
  enforceRankingFeature(planFeatures, { ranking: mergedSettings.ranking });

  const settings = await GamificationSettingsModel.findOneAndUpdate(
    {
      organizationId,
      guildId: input.guildId,
    },
    {
      $set: {
        enabled: mergedSettings.enabled,
        ranking: mergedSettings.ranking,
        badges: mergedSettings.badges,
        streaks: mergedSettings.streaks,
        teamGoals: mergedSettings.teamGoals,
        updatedBy,
      },
      $setOnInsert: {
        organizationId,
        guildId: input.guildId,
      },
    },
    { upsert: true, new: true },
  ).exec();

  if (!settings) {
    throw new Error('Falha ao persistir configurações de gamificação');
  }

  return {
    settings,
    planFeatures,
    plan: { name: planContext.name, slug: planContext.slug },
  };
}
