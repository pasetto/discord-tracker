import { Document, Schema, Types, model } from 'mongoose';

/**
 * Visibilidade permitida para o ranking.
 */
export type RankingVisibility = 'private' | 'team' | 'guild';

/**
 * Métricas permitidas para classificação no ranking.
 */
export type RankingMetric = 'productive_hours' | 'voice_hours' | 'online_hours' | 'collaboration_score';

/**
 * Períodos suportados para cálculo de ranking.
 */
export type RankingPeriod = 'daily' | 'weekly' | 'monthly';

/**
 * Pacotes de badges disponíveis no MVP.
 */
export type BadgePresetPack = 'minimal' | 'standard' | 'full';

/**
 * Equipe configurada manualmente para escopo de ranking por time.
 */
export interface IGamificationTeam {
  id: string;
  name: string;
  memberDiscordIds: string[];
  categoryId?: Types.ObjectId;
}

/**
 * Configurações de ranking da gamificação por guild.
 */
export interface IGamificationRankingSettings {
  enabled: boolean;
  visibility: RankingVisibility;
  metric: RankingMetric;
  period: RankingPeriod;
  topCount: number;
  showExactHours: boolean;
  anonymousMode: boolean;
  excludedRoleIds: string[];
  includedChannelIds: string[];
  teams: IGamificationTeam[];
}

/**
 * Configurações de badges da gamificação.
 */
export interface IGamificationBadgesSettings {
  enabled: boolean;
  presetPack: BadgePresetPack;
}

/**
 * Configurações de streaks por guild.
 */
export interface IGamificationStreaksSettings {
  enabled: boolean;
  minProductiveHoursPerDay: number;
}

/**
 * Configurações de metas coletivas legadas no escopo de gamificação.
 */
export interface IGamificationTeamGoalsSettings {
  enabled: boolean;
  weeklyProductiveHoursTarget?: number;
}

/**
 * Documento de configuração de gamificação por guild.
 */
export interface IGamificationSettings extends Document {
  organizationId: Types.ObjectId;
  guildId: string;
  enabled: boolean;
  ranking: IGamificationRankingSettings;
  badges: IGamificationBadgesSettings;
  streaks: IGamificationStreaksSettings;
  teamGoals: IGamificationTeamGoalsSettings;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const gamificationTeamSchema = new Schema<IGamificationTeam>(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    memberDiscordIds: { type: [String], required: true, default: [] },
    categoryId: { type: Schema.Types.ObjectId, ref: 'MemberCategory', required: false },
  },
  { _id: false },
);

const rankingSettingsSchema = new Schema<IGamificationRankingSettings>(
  {
    enabled: { type: Boolean, required: true, default: false },
    visibility: { type: String, enum: ['private', 'team', 'guild'], required: true, default: 'private' },
    metric: {
      type: String,
      enum: ['productive_hours', 'voice_hours', 'online_hours', 'collaboration_score'],
      required: true,
      default: 'productive_hours',
    },
    period: { type: String, enum: ['daily', 'weekly', 'monthly'], required: true, default: 'weekly' },
    topCount: { type: Number, required: true, min: 1, max: 50, default: 10 },
    showExactHours: { type: Boolean, required: true, default: true },
    anonymousMode: { type: Boolean, required: true, default: false },
    excludedRoleIds: { type: [String], required: true, default: [] },
    includedChannelIds: { type: [String], required: true, default: [] },
    teams: { type: [gamificationTeamSchema], required: true, default: [] },
  },
  { _id: false },
);

const badgesSettingsSchema = new Schema<IGamificationBadgesSettings>(
  {
    enabled: { type: Boolean, required: true, default: false },
    presetPack: { type: String, enum: ['minimal', 'standard', 'full'], required: true, default: 'minimal' },
  },
  { _id: false },
);

const streaksSettingsSchema = new Schema<IGamificationStreaksSettings>(
  {
    enabled: { type: Boolean, required: true, default: false },
    minProductiveHoursPerDay: { type: Number, required: true, min: 0, default: 1 },
  },
  { _id: false },
);

const teamGoalsSettingsSchema = new Schema<IGamificationTeamGoalsSettings>(
  {
    enabled: { type: Boolean, required: true, default: false },
    weeklyProductiveHoursTarget: { type: Number, required: false, min: 0 },
  },
  { _id: false },
);

const gamificationSettingsSchema = new Schema<IGamificationSettings>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    guildId: { type: String, required: true, trim: true },
    enabled: { type: Boolean, required: true, default: false },
    ranking: { type: rankingSettingsSchema, required: true, default: () => ({}) },
    badges: { type: badgesSettingsSchema, required: true, default: () => ({}) },
    streaks: { type: streaksSettingsSchema, required: true, default: () => ({}) },
    teamGoals: { type: teamGoalsSettingsSchema, required: true, default: () => ({}) },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
  },
  { timestamps: true },
);

gamificationSettingsSchema.index({ organizationId: 1, guildId: 1 }, { unique: true });

/** Model Mongoose para collection gamification_settings. */
export const GamificationSettingsModel = model<IGamificationSettings>(
  'GamificationSettings',
  gamificationSettingsSchema,
);
