import { Types } from 'mongoose';
import type { Guild, GuildMember, PresenceStatus as DiscordPresenceStatus } from 'discord.js';
import { discordClient } from '../bot/client';
import { mapDiscordPresenceStatus } from './channelClassifier';
import { presenceSessionRepository } from '../repositories/presenceSessionRepository';
import { voiceSessionRepository } from '../repositories/voiceSessionRepository';
import { voiceChannelTransitionRepository } from '../repositories/voiceChannelTransitionRepository';
import { User } from '../db/models/User';
import { OrganizationModel } from '../db/models/Organization';
import type { PresenceStatus, VoiceEventType, VoiceSessionType } from '../config/env';
import type { LiveVoiceTransitionEvent } from './liveActivityBroadcaster';
import { clampSecondsToWindow } from '../utils/sessionTimeUtils';
import { getDayBounds, formatDateString } from '../utils/timezone';
import { config } from '../config/env';
import { runWithDiscordBot } from './discordClusterProxy';
import { resolveDiscordUserAvatarUrl } from '../utils/discordAvatar';

/** Membro ativo no servidor com localização e tempos de colaboração. */
export interface LiveMemberSnapshot {
  discordId: string;
  displayName: string;
  /** URL do avatar Discord (CDN), quando disponível no cache do bot */
  avatarUrl?: string;
  status: PresenceStatus;
  voiceChannelId: string | null;
  voiceChannelName: string | null;
  onlineSeconds: number;
  onlineSince: string | null;
  collaborationActiveSeconds: number;
  inactiveSeconds: number;
  isCollaborationActive: boolean;
  inIgnoredChannel: boolean;
  voiceSessionType: VoiceSessionType | null;
  channelsVisitedToday: string[];
}

/** Snapshot em tempo real do dashboard por guild. */
export interface DashboardLiveSnapshot {
  generatedAt: string;
  /** Data civil (YYYY-MM-DD) usada nos totais "hoje". */
  dayDate: string;
  /** Timezone IANA usada para o dia civil. */
  timezone: string;
  guildId: string;
  guildName: string;
  activeCount: number;
  activeMembers: LiveMemberSnapshot[];
  onlineRanking: LiveMemberSnapshot[];
  recentTransitions: LiveVoiceTransitionEvent[];
}

const ACTIVE_PRESENCE_STATUSES = new Set<PresenceStatus>(['ONLINE', 'IDLE', 'DND']);

/**
 * Monta snapshot ao vivo de membros ativos, tempos acumulados do dia e transições recentes.
 * @param guildId ID do servidor Discord monitorado
 * @param organizationId ID da organização (opcional; usado para histórico de canais)
 * @returns Membros ativos, ranking e feed de transições
 * @throws {Error} Quando o bot não está conectado ou não está no servidor
 */
export async function getGuildLiveDashboard(
  guildId: string,
  organizationId?: string,
): Promise<DashboardLiveSnapshot> {
  const orgQuery = organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : '';
  return runWithDiscordBot({
    guildId,
    internalPath: `/internal/discord/guilds/${guildId}/live-dashboard${orgQuery}`,
    onBotInstance: () => buildGuildLiveDashboardOnBotInstance(guildId, organizationId),
  });
}

/**
 * Monta snapshot ao vivo no processo que hospeda o bot Discord (sem proxy de cluster).
 * @param guildId ID do servidor Discord monitorado
 * @param organizationId ID da organização (opcional; usado para histórico de canais)
 * @returns Membros ativos, ranking e feed de transições
 * @throws {Error} Quando o bot não está conectado ou não está no servidor
 */
export async function buildGuildLiveDashboardOnBotInstance(
  guildId: string,
  organizationId?: string,
): Promise<DashboardLiveSnapshot> {
  if (!organizationId?.trim()) {
    throw new Error('organizationId é obrigatório para o dashboard ao vivo');
  }

  const guild = await resolveDiscordGuild(guildId);

  const now = Date.now();
  const nowDate = new Date(now);
  const timezone = await resolveOrganizationTimezone(organizationId);
  const { start: dayStart } = getDayBounds(nowDate, timezone);

  const humanMembers = [...guild.members.cache.values()].filter((member) => !member.user.bot);
  const allDiscordIds = humanMembers.map((member) => member.id);

  const users = await User.find({ discordId: { $in: allDiscordIds } })
    .select('_id discordId')
    .lean<Array<{ _id: unknown; discordId: string }>>();
  const discordIdToUserId = new Map(users.map((user) => [user.discordId, String(user._id)]));
  const userObjectIds = users.map((user) => user._id);
  const sessionScope = { organizationId: new Types.ObjectId(organizationId), guildId };

  const [voiceTodayByUser, onlineTodayByUser, openSessions, openVoiceSessions, todayTransitions, recentTransitionsRaw] =
    await Promise.all([
      voiceSessionRepository.sumTodayByUserIds(
        userObjectIds as Types.ObjectId[],
        sessionScope.organizationId,
        sessionScope.guildId,
        dayStart,
        nowDate,
      ),
      presenceSessionRepository.sumTodayOnlineByUserIds(
        userObjectIds as Types.ObjectId[],
        sessionScope.organizationId,
        sessionScope.guildId,
        dayStart,
        nowDate,
      ),
      presenceSessionRepository.findAllOpen(sessionScope),
      voiceSessionRepository.findAllOpen(sessionScope),
      voiceChannelTransitionRepository.findSinceByGuild(organizationId, guildId, dayStart),
      voiceChannelTransitionRepository.findRecentByGuild(organizationId, guildId, 20),
    ]);

  const sessionByUserId = new Map(
    openSessions
      .filter((session) => ACTIVE_PRESENCE_STATUSES.has(session.status))
      .map((session) => [String(session.userId), session]),
  );
  const voiceByUserId = new Map(openVoiceSessions.map((session) => [String(session.userId), session]));
  const channelsVisitedByDiscordId = buildChannelsVisitedMap(todayTransitions);

  const activeMembers: LiveMemberSnapshot[] = [];
  const rankingCandidates: LiveMemberSnapshot[] = [];

  for (const member of humanMembers) {
    const userId = discordIdToUserId.get(member.id);
    const snapshot = buildMemberSnapshot(
      member,
      userId,
      voiceTodayByUser,
      onlineTodayByUser,
      sessionByUserId,
      voiceByUserId,
      channelsVisitedByDiscordId,
      dayStart,
      nowDate,
    );

    const inVoice = member.voice.channelId !== null;
    const presenceActive = isDiscordMemberActive(member.presence?.status ?? 'offline');
    if (inVoice || presenceActive) {
      activeMembers.push(snapshot);
    }

    const hasActivityToday =
      snapshot.collaborationActiveSeconds > 0 ||
      snapshot.inactiveSeconds > 0 ||
      snapshot.onlineSeconds > 0;

    if (hasActivityToday) {
      rankingCandidates.push(snapshot);
    }
  }

  activeMembers.sort((left, right) => left.displayName.localeCompare(right.displayName, 'pt-BR'));
  const onlineRanking = [...rankingCandidates].sort((left, right) => {
    if (right.collaborationActiveSeconds !== left.collaborationActiveSeconds) {
      return right.collaborationActiveSeconds - left.collaborationActiveSeconds;
    }
    if (right.onlineSeconds !== left.onlineSeconds) {
      return right.onlineSeconds - left.onlineSeconds;
    }
    return left.displayName.localeCompare(right.displayName, 'pt-BR');
  });

  const recentTransitions = recentTransitionsRaw.map((transition) =>
    mapTransitionToEvent(transition, organizationId, guild),
  );

  return {
    generatedAt: nowDate.toISOString(),
    dayDate: formatDateString(nowDate, timezone),
    timezone,
    guildId: guild.id,
    guildName: guild.name,
    activeCount: activeMembers.length,
    activeMembers,
    onlineRanking,
    recentTransitions,
  };
}

/**
 * Monta snapshot de um membro combinando Discord cache e totais do dia no banco.
 * @param member Membro do guild no cache Discord
 * @param userId ID Mongo do usuário ou undefined quando ainda não rastreado
 * @param voiceTodayByUser Totais de voz do dia
 * @param onlineTodayByUser Totais de presença online do dia
 * @param sessionByUserId Sessões de presença abertas
 * @param voiceByUserId Sessões de voz abertas
 * @param channelsVisitedByDiscordId Histórico de salas visitadas hoje
 * @param dayStart Início do dia civil (timezone da aplicação)
 * @param windowEnd Fim da janela de cálculo ("agora")
 * @returns Snapshot do membro
 */
function buildMemberSnapshot(
  member: GuildMember,
  userId: string | undefined,
  voiceTodayByUser: Map<string, { collaborationSeconds: number; inactiveSeconds: number }>,
  onlineTodayByUser: Map<string, number>,
  sessionByUserId: Map<string, { startedAt: Date; status: PresenceStatus }>,
  voiceByUserId: Map<string, { isIgnoredChannel: boolean; sessionType: VoiceSessionType }>,
  channelsVisitedByDiscordId: Map<string, string[]>,
  dayStart: Date,
  windowEnd: Date,
): LiveMemberSnapshot {
  const voiceTotals = userId ? voiceTodayByUser.get(userId) : undefined;
  const onlineSeconds = userId ? (onlineTodayByUser.get(userId) ?? 0) : 0;
  const openSession = userId ? sessionByUserId.get(userId) : undefined;
  const openVoice = userId ? voiceByUserId.get(userId) : undefined;
  const discordPresenceStatus = member.presence?.status ?? 'offline';

  return {
    discordId: member.id,
    displayName: member.displayName ?? member.user.globalName ?? member.user.username,
    avatarUrl: resolveDiscordUserAvatarUrl(member.user),
    status: mapDiscordPresenceStatus(discordPresenceStatus),
    voiceChannelId: member.voice.channelId,
    voiceChannelName: member.voice.channel?.name ?? null,
    onlineSeconds: clampSecondsToWindow(onlineSeconds, dayStart, windowEnd),
    onlineSince: openSession?.startedAt?.toISOString() ?? null,
    collaborationActiveSeconds: clampSecondsToWindow(voiceTotals?.collaborationSeconds ?? 0, dayStart, windowEnd),
    inactiveSeconds: clampSecondsToWindow(voiceTotals?.inactiveSeconds ?? 0, dayStart, windowEnd),
    isCollaborationActive: openVoice !== undefined && !openVoice.isIgnoredChannel && openVoice.sessionType === 'VOICE',
    inIgnoredChannel: openVoice?.isIgnoredChannel ?? false,
    voiceSessionType: openVoice?.sessionType ?? null,
    channelsVisitedToday: channelsVisitedByDiscordId.get(member.id) ?? [],
  };
}

/**
 * Monta mapa de salas visitadas hoje por discordId a partir das transições.
 * @param transitions Transições do dia
 * @returns Mapa discordId → nomes de canais em ordem de visita
 */
function buildChannelsVisitedMap(
  transitions: Array<{
    discordId: string;
    eventType: VoiceEventType;
    fromChannelName?: string;
    toChannelName?: string;
  }>,
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const transition of transitions) {
    const list = map.get(transition.discordId) ?? [];

    if (transition.fromChannelName && (transition.eventType === 'LEAVE' || transition.eventType === 'DISCONNECT')) {
      appendChannelName(list, transition.fromChannelName);
    }

    if (
      transition.toChannelName &&
      (transition.eventType === 'JOIN' ||
        transition.eventType === 'SWITCH' ||
        transition.eventType === 'MOVED' ||
        transition.eventType === 'AFK_AUTO' ||
        transition.eventType === 'RECONNECT')
    ) {
      appendChannelName(list, transition.toChannelName);
    }

    map.set(transition.discordId, list);
  }

  return map;
}

/**
 * Adiciona nome de canal ao histórico evitando duplicata consecutiva.
 * @param list Lista mutável de nomes
 * @param channelName Nome do canal
 */
function appendChannelName(list: string[], channelName: string): void {
  if (list[list.length - 1] === channelName) {
    return;
  }
  list.push(channelName);
}

/**
 * Converte documento de transição para evento WebSocket.
 * @param transition Documento persistido
 * @param organizationId ID da organização
 * @param organizationId Organização tenant
 * @param guild Guild Discord para resolver avatar do membro
 * @returns Evento serializável
 */
function mapTransitionToEvent(
  transition: {
    organizationId: unknown;
    guildId: string;
    discordId: string;
    displayName: string;
    eventType: VoiceEventType;
    fromChannelName?: string;
    toChannelName?: string;
    fromIgnored: boolean;
    toIgnored: boolean;
    countsAsCollaboration: boolean;
    occurredAt: Date;
  },
  organizationId: string,
  guild: Guild,
): LiveVoiceTransitionEvent {
  const member = guild.members.cache.get(transition.discordId);

  return {
    organizationId: organizationId || String(transition.organizationId),
    guildId: transition.guildId,
    discordId: transition.discordId,
    displayName: transition.displayName,
    avatarUrl: member ? resolveDiscordUserAvatarUrl(member.user) : undefined,
    eventType: transition.eventType,
    fromChannelName: transition.fromChannelName,
    toChannelName: transition.toChannelName,
    fromIgnored: transition.fromIgnored,
    toIgnored: transition.toIgnored,
    countsAsCollaboration: transition.countsAsCollaboration,
    occurredAt: transition.occurredAt.toISOString(),
  };
}

/**
 * Resolve guild no cache Discord ou via API quando ausente do cache.
 * @param guildId ID do servidor Discord
 * @returns Guild carregado
 * @throws {Error} Quando o bot não está no servidor
 */
async function resolveDiscordGuild(guildId: string): Promise<Guild> {
  const cached = discordClient.guilds.cache.get(guildId);
  if (cached) {
    return cached;
  }

  try {
    return await discordClient.guilds.fetch(guildId);
  } catch {
    throw new Error('Bot não encontrou este servidor. Adicione o bot ao servidor e selecione-o novamente.');
  }
}

/**
 * Obtém timezone IANA da organização para limites do dia civil.
 * @param organizationId ID da organização (opcional)
 * @returns Timezone IANA
 */
async function resolveOrganizationTimezone(organizationId?: string): Promise<string> {
  if (!organizationId) {
    return config.timezone;
  }

  const organization = await OrganizationModel.findById(organizationId)
    .select('settings.timezone')
    .lean<{ settings?: { timezone?: string } }>()
    .exec();

  return organization?.settings?.timezone ?? config.timezone;
}

/**
 * Indica se o status bruto do Discord representa usuário ativo na dashboard.
 * @param status Status retornado pelo Discord.js
 * @returns true para online, idle ou dnd
 */
function isDiscordMemberActive(status: DiscordPresenceStatus): boolean {
  return status === 'online' || status === 'idle' || status === 'dnd';
}
