import { Types } from 'mongoose';
import type { BadgePresetPack } from '../db/models/GamificationSettings';
import { GamificationSettingsModel } from '../db/models/GamificationSettings';
import { OrganizationModel } from '../db/models/Organization';
import { TextActivityEventModel } from '../db/models/TextActivityEvent';
import { TrackedUserModel } from '../db/models/TrackedUser';
import { User } from '../db/models/User';
import { VoiceSession } from '../db/models/VoiceSession';
import { PresenceSession } from '../db/models/PresenceSession';
import { getOrganizationPlanContext } from './gamificationService';
import { endOfUtcDay, overlapSeconds, startOfUtcDay, startOfUtcWeek } from '../utils/sessionTimeUtils';

/** Definição estática de um badge disponível no catálogo. */
export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
}

/** Badge conquistado pelo colaborador. */
export interface EarnedBadgeDto extends BadgeDefinition {
  earnedInPeriod: string;
}

/** Resumo de streak do colaborador. */
export interface MemberStreakDto {
  enabled: boolean;
  currentDays: number;
  minHoursPerDay: number;
  lastQualifiedDate: string | null;
}

/** Insights de gamificação de um membro. */
export interface MemberGamificationInsightsDto {
  discordId: string;
  displayName: string;
  badgesEnabled: boolean;
  streaksEnabled: boolean;
  badges: EarnedBadgeDto[];
  streak: MemberStreakDto;
}

/** Visão agregada da guild para relatório de conquistas. */
export interface GuildGamificationInsightsDto {
  available: boolean;
  reason?: string;
  presetPack: BadgePresetPack;
  generatedAt: string;
  members: MemberGamificationInsightsDto[];
}

/**
 * Catálogo completo de badges por pacote.
 */
const BADGE_CATALOG: Record<string, BadgeDefinition> = {
  early_bird: {
    id: 'early_bird',
    name: 'Madrugador',
    description: 'Iniciou colaboração em voz antes das 10h em algum dia recente.',
    icon: '🌅',
  },
  collaborator: {
    id: 'collaborator',
    name: 'Colaborador',
    description: 'Atingiu pelo menos 5 horas colaborativas na semana atual.',
    icon: '🤝',
  },
  voice_champion: {
    id: 'voice_champion',
    name: 'Campeão de voz',
    description: 'Acumulou 10+ horas em canais de voz na semana atual.',
    icon: '🎙️',
  },
  text_contributor: {
    id: 'text_contributor',
    name: 'Sinal de texto',
    description: 'Registrou 15+ eventos de texto colaborativo na semana (metadados).',
    icon: '💬',
  },
  presence_steady: {
    id: 'presence_steady',
    name: 'Presença constante',
    description: 'Manteve 15+ horas online na semana atual.',
    icon: '🟢',
  },
};

const PACK_BADGE_IDS: Record<BadgePresetPack, string[]> = {
  minimal: ['early_bird', 'collaborator'],
  standard: ['early_bird', 'collaborator', 'voice_champion'],
  full: ['early_bird', 'collaborator', 'voice_champion', 'text_contributor', 'presence_steady'],
};

const ONLINE_STATUSES = new Set(['ONLINE', 'IDLE', 'DND']);

/**
 * Converte string para ObjectId válido.
 * @param value Valor textual
 * @param label Nome do campo
 * @returns ObjectId parseado
 */
function parseObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} inválido`);
  }
  return new Types.ObjectId(value);
}

/**
 * Obtém offset UTC em horas para timezone IANA (simplificado para America/Sao_Paulo).
 * @param timezone Timezone da organização
 * @param date Data de referência
 * @returns Offset em horas
 */
function getTimezoneOffsetHours(timezone: string, date: Date): number {
  if (timezone === 'America/Sao_Paulo') {
    return -3;
  }
  return 0;
}

/**
 * Retorna hora local aproximada para avaliação do badge Madrugador.
 * @param utcDate Instante UTC
 * @param timezone Timezone da organização
 * @returns Hora local 0–23
 */
function localHour(utcDate: Date, timezone: string): number {
  const offset = getTimezoneOffsetHours(timezone, utcDate);
  return (utcDate.getUTCHours() + offset + 24) % 24;
}

/**
 * Soma segundos produtivos em voz de um usuário em um intervalo.
 * @param coreUserId ID Mongo do usuário core
 * @param organizationId Organização tenant
 * @param guildId Guild monitorada
 * @param periodStart Início
 * @param periodEnd Fim
 * @returns Segundos colaborativos
 */
async function sumProductiveVoiceSeconds(
  coreUserId: Types.ObjectId,
  organizationId: Types.ObjectId,
  guildId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const rows = await VoiceSession.aggregate<{ total: number }>([
    {
      $match: {
        userId: coreUserId,
        organizationId,
        guildId,
        startedAt: { $gte: periodStart, $lte: periodEnd },
        durationSeconds: { $gt: 0 },
        isIgnoredChannel: false,
        sessionType: 'VOICE',
      },
    },
    { $group: { _id: null, total: { $sum: '$durationSeconds' } } },
  ]);
  return rows[0]?.total ?? 0;
}

/**
 * Soma segundos totais em voz (inclui canais ignorados).
 * @param coreUserId ID Mongo do usuário core
 * @param organizationId Organização tenant
 * @param guildId Guild monitorada
 * @param periodStart Início
 * @param periodEnd Fim
 * @returns Segundos em voz
 */
async function sumVoiceSeconds(
  coreUserId: Types.ObjectId,
  organizationId: Types.ObjectId,
  guildId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const rows = await VoiceSession.aggregate<{ total: number }>([
    {
      $match: {
        userId: coreUserId,
        organizationId,
        guildId,
        startedAt: { $gte: periodStart, $lte: periodEnd },
        durationSeconds: { $gt: 0 },
        sessionType: 'VOICE',
      },
    },
    { $group: { _id: null, total: { $sum: '$durationSeconds' } } },
  ]);
  return rows[0]?.total ?? 0;
}

/**
 * Soma segundos online (ONLINE/IDLE/DND) no período.
 * @param coreUserId ID Mongo
 * @param organizationId Organização tenant
 * @param guildId Guild monitorada
 * @param periodStart Início
 * @param periodEnd Fim
 * @returns Horas online
 */
async function sumOnlineHours(
  coreUserId: Types.ObjectId,
  organizationId: Types.ObjectId,
  guildId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const sessions = await PresenceSession.find({
    userId: coreUserId,
    organizationId,
    guildId,
    startedAt: { $lte: periodEnd },
    $or: [{ endedAt: null }, { endedAt: { $gte: periodStart } }],
    status: { $in: Array.from(ONLINE_STATUSES) },
  })
    .select({ startedAt: 1, endedAt: 1 })
    .lean()
    .exec();

  let total = 0;
  for (const session of sessions) {
    total += overlapSeconds(session.startedAt, session.endedAt, periodStart, periodEnd);
  }
  return Number((total / 3600).toFixed(2));
}

/**
 * Conta eventos de texto do colaborador na guild no período.
 * @param organizationId Organização
 * @param guildId Guild
 * @param discordId Discord ID
 * @param periodStart Início
 * @param periodEnd Fim
 * @returns Quantidade de eventos
 */
async function countTextEvents(
  organizationId: Types.ObjectId,
  guildId: string,
  discordId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  return TextActivityEventModel.countDocuments({
    organizationId,
    guildId,
    discordId,
    occurredAt: { $gte: periodStart, $lte: periodEnd },
  }).exec();
}

/**
 * Verifica badge Madrugador (sessão de voz antes das 10h nos últimos 30 dias).
 * @param coreUserId Usuário core
 * @param organizationId Organização tenant
 * @param guildId Guild monitorada
 * @param timezone Timezone org
 * @param referenceDate Data de referência
 * @returns Se conquistado
 */
async function hasEarlyBirdBadge(
  coreUserId: Types.ObjectId,
  organizationId: Types.ObjectId,
  guildId: string,
  timezone: string,
  referenceDate: Date,
): Promise<boolean> {
  const lookbackStart = new Date(referenceDate.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sessions = await VoiceSession.find({
    userId: coreUserId,
    organizationId,
    guildId,
    startedAt: { $gte: lookbackStart, $lte: referenceDate },
    isIgnoredChannel: false,
    sessionType: 'VOICE',
  })
    .select({ startedAt: 1 })
    .lean()
    .exec();

  return sessions.some((session) => localHour(session.startedAt, timezone) < 10);
}

/**
 * Calcula streak de dias consecutivos com horas mínimas de colaboração.
 * @param coreUserId Usuário core
 * @param organizationId Organização tenant
 * @param guildId Guild monitorada
 * @param minHours Mínimo diário configurado
 * @param referenceDate Data de referência
 * @returns Dias consecutivos e última data qualificada
 */
async function calculateStreak(
  coreUserId: Types.ObjectId,
  organizationId: Types.ObjectId,
  guildId: string,
  minHours: number,
  referenceDate: Date,
): Promise<{ currentDays: number; lastQualifiedDate: Date | null }> {
  const minSeconds = minHours * 3600;
  let streak = 0;
  let lastQualified: Date | null = null;
  const today = startOfUtcDay(referenceDate);
  const todayEnd = endOfUtcDay(today);
  const todaySeconds = await sumProductiveVoiceSeconds(coreUserId, organizationId, guildId, today, todayEnd);
  const startOffset = todaySeconds >= minSeconds ? 0 : 1;

  for (let day = startOffset; day < 90; day += 1) {
    const dayStart = new Date(today.getTime() - day * 24 * 60 * 60 * 1000);
    const dayEnd = endOfUtcDay(dayStart);
    const seconds = await sumProductiveVoiceSeconds(coreUserId, organizationId, guildId, dayStart, dayEnd);
    if (seconds >= minSeconds) {
      streak += 1;
      lastQualified = dayStart;
    } else {
      break;
    }
  }

  return { currentDays: streak, lastQualifiedDate: lastQualified };
}

/**
 * Avalia badges conquistados para um membro.
 * @param input Contexto de cálculo
 * @returns Lista de badges ganhos
 */
async function evaluateBadges(input: {
  organizationId: Types.ObjectId;
  guildId: string;
  discordId: string;
  coreUserId: Types.ObjectId;
  presetPack: BadgePresetPack;
  timezone: string;
  referenceDate: Date;
}): Promise<EarnedBadgeDto[]> {
  const weekStart = startOfUtcWeek(input.referenceDate);
  const weekEnd = endOfUtcDay(input.referenceDate);
  const earned: EarnedBadgeDto[] = [];
  const badgeIds = PACK_BADGE_IDS[input.presetPack];

  const [productiveSeconds, voiceSeconds, onlineHours, textCount, earlyBird] = await Promise.all([
    sumProductiveVoiceSeconds(input.coreUserId, input.organizationId, input.guildId, weekStart, weekEnd),
    sumVoiceSeconds(input.coreUserId, input.organizationId, input.guildId, weekStart, weekEnd),
    sumOnlineHours(input.coreUserId, input.organizationId, input.guildId, weekStart, weekEnd),
    countTextEvents(input.organizationId, input.guildId, input.discordId, weekStart, weekEnd),
    badgeIds.includes('early_bird')
      ? hasEarlyBirdBadge(input.coreUserId, input.organizationId, input.guildId, input.timezone, input.referenceDate)
      : false,
  ]);

  const productiveHours = productiveSeconds / 3600;
  const voiceHours = voiceSeconds / 3600;
  const periodLabel = weekEnd.toISOString();

  const checks: Record<string, boolean> = {
    early_bird: earlyBird,
    collaborator: productiveHours >= 5,
    voice_champion: voiceHours >= 10,
    text_contributor: textCount >= 15,
    presence_steady: onlineHours >= 15,
  };

  for (const badgeId of badgeIds) {
    if (checks[badgeId] && BADGE_CATALOG[badgeId]) {
      earned.push({
        ...BADGE_CATALOG[badgeId],
        earnedInPeriod: periodLabel,
      });
    }
  }

  return earned;
}

/**
 * Calcula insights de gamificação para um membro rastreado.
 * @param input Tenant, guild e membro
 * @returns Badges e streak do colaborador
 */
export async function getMemberGamificationInsights(input: {
  organizationId: string;
  guildId: string;
  discordId: string;
  displayName: string;
  referenceDate?: Date;
}): Promise<MemberGamificationInsightsDto> {
  const organizationId = parseObjectId(input.organizationId, 'organizationId');
  const referenceDate = input.referenceDate ?? new Date();

  const [settings, organization, coreUser] = await Promise.all([
    GamificationSettingsModel.findOne({ organizationId, guildId: input.guildId }).lean().exec(),
    OrganizationModel.findById(organizationId).select({ 'settings.timezone': 1 }).lean().exec(),
    User.findOne({ discordId: input.discordId }).select({ _id: 1 }).lean().exec(),
  ]);

  const timezone = organization?.settings?.timezone ?? 'America/Sao_Paulo';
  const badgesEnabled = Boolean(settings?.enabled && settings.badges.enabled);
  const streaksEnabled = Boolean(settings?.enabled && settings.streaks.enabled);
  const presetPack = settings?.badges.presetPack ?? 'minimal';
  const minHours = settings?.streaks.minProductiveHoursPerDay ?? 1;

  const emptyStreak: MemberStreakDto = {
    enabled: streaksEnabled,
    currentDays: 0,
    minHoursPerDay: minHours,
    lastQualifiedDate: null,
  };

  if (!coreUser?._id) {
    return {
      discordId: input.discordId,
      displayName: input.displayName,
      badgesEnabled,
      streaksEnabled,
      badges: [],
      streak: emptyStreak,
    };
  }

  const coreUserId = coreUser._id as Types.ObjectId;

  const [badges, streakResult] = await Promise.all([
    badgesEnabled
      ? evaluateBadges({
          organizationId,
          guildId: input.guildId,
          discordId: input.discordId,
          coreUserId,
          presetPack,
          timezone,
          referenceDate,
        })
      : Promise.resolve([]),
    streaksEnabled
      ? calculateStreak(coreUserId, organizationId, input.guildId, minHours, referenceDate)
      : Promise.resolve({ currentDays: 0, lastQualifiedDate: null }),
  ]);

  return {
    discordId: input.discordId,
    displayName: input.displayName,
    badgesEnabled,
    streaksEnabled,
    badges,
    streak: {
      enabled: streaksEnabled,
      currentDays: streakResult.currentDays,
      minHoursPerDay: minHours,
      lastQualifiedDate: streakResult.lastQualifiedDate?.toISOString() ?? null,
    },
  };
}

/**
 * Lista insights de gamificação de todos os membros rastreados da guild.
 * @param input Tenant e guild
 * @returns Relatório de conquistas da equipe
 */
export async function getGuildGamificationInsights(input: {
  organizationId: string;
  guildId: string;
  referenceDate?: Date;
}): Promise<GuildGamificationInsightsDto> {
  const organizationId = parseObjectId(input.organizationId, 'organizationId');
  const referenceDate = input.referenceDate ?? new Date();
  const generatedAt = referenceDate.toISOString();

  let planOk = true;
  try {
    const plan = await getOrganizationPlanContext(organizationId);
    planOk = plan.gamification;
  } catch {
    planOk = false;
  }

  const settings = await GamificationSettingsModel.findOne({ organizationId, guildId: input.guildId }).lean().exec();

  if (!planOk) {
    return {
      available: false,
      reason: 'Gamificação não está disponível no plano atual',
      presetPack: 'minimal',
      generatedAt,
      members: [],
    };
  }

  if (!settings?.enabled) {
    return {
      available: false,
      reason: 'Gamificação não está habilitada para este servidor',
      presetPack: settings?.badges.presetPack ?? 'minimal',
      generatedAt,
      members: [],
    };
  }

  if (!settings.badges.enabled && !settings.streaks.enabled) {
    return {
      available: false,
      reason: 'Badges e streaks estão desabilitados nas configurações',
      presetPack: settings.badges.presetPack,
      generatedAt,
      members: [],
    };
  }

  const trackedUsers = await TrackedUserModel.find({ organizationId, guildId: input.guildId })
    .select({ discordId: 1, displayName: 1 })
    .lean()
    .exec();

  const members = await Promise.all(
    trackedUsers.map((user) =>
      getMemberGamificationInsights({
        organizationId: input.organizationId,
        guildId: input.guildId,
        discordId: user.discordId,
        displayName: user.displayName,
        referenceDate,
      }),
    ),
  );

  return {
    available: true,
    presetPack: settings.badges.presetPack,
    generatedAt,
    members,
  };
}
