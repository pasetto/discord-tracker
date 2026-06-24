import { Types } from 'mongoose';
import type { GuildMember, PresenceStatus as DiscordPresenceStatus } from 'discord.js';
import { discordClient, isDiscordReady } from '../bot/client';
import { mapDiscordPresenceStatus } from './channelClassifier';
import { presenceSessionRepository } from '../repositories/presenceSessionRepository';
import { voiceSessionRepository } from '../repositories/voiceSessionRepository';
import { voiceChannelTransitionRepository } from '../repositories/voiceChannelTransitionRepository';
import { User } from '../db/models/User';
import type { PresenceStatus, VoiceEventType, VoiceSessionType } from '../config/env';
import type { LiveVoiceTransitionEvent } from './liveActivityBroadcaster';
import { startOfUtcDay } from '../utils/sessionTimeUtils';

/** Membro ativo no servidor com localização e tempos de colaboração. */
export interface LiveMemberSnapshot {
  discordId: string;
  displayName: string;
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
  if (!isDiscordReady) {
    throw new Error('Bot Discord não conectado. Verifique a configuração em Configurações → Discord.');
  }

  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) {
    throw new Error('Bot não encontrou este servidor. Adicione o bot ao servidor e selecione-o novamente.');
  }

  const now = Date.now();
  const nowDate = new Date(now);
  const dayStart = startOfUtcDay(nowDate);

  const humanMembers = [...guild.members.cache.values()].filter((member) => !member.user.bot);
  const allDiscordIds = humanMembers.map((member) => member.id);

  const users = await User.find({ discordId: { $in: allDiscordIds } })
    .select('_id discordId')
    .lean<Array<{ _id: unknown; discordId: string }>>();
  const discordIdToUserId = new Map(users.map((user) => [user.discordId, String(user._id)]));
  const userObjectIds = users.map((user) => user._id);

  const [voiceTodayByUser, onlineTodayByUser, openSessions, openVoiceSessions, todayTransitions, recentTransitionsRaw] =
    await Promise.all([
      voiceSessionRepository.sumTodayByUserIds(userObjectIds as Types.ObjectId[], dayStart, nowDate),
      presenceSessionRepository.sumTodayOnlineByUserIds(userObjectIds as Types.ObjectId[], dayStart, nowDate),
      presenceSessionRepository.findAllOpen(),
      voiceSessionRepository.findAllOpen(),
      organizationId
        ? voiceChannelTransitionRepository.findSinceByGuild(organizationId, guildId, dayStart)
        : Promise.resolve([]),
      organizationId
        ? voiceChannelTransitionRepository.findRecentByGuild(organizationId, guildId, 20)
        : Promise.resolve([]),
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
    mapTransitionToEvent(transition, organizationId ?? ''),
  );

  return {
    generatedAt: nowDate.toISOString(),
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
): LiveMemberSnapshot {
  const voiceTotals = userId ? voiceTodayByUser.get(userId) : undefined;
  const onlineSeconds = userId ? (onlineTodayByUser.get(userId) ?? 0) : 0;
  const openSession = userId ? sessionByUserId.get(userId) : undefined;
  const openVoice = userId ? voiceByUserId.get(userId) : undefined;
  const discordPresenceStatus = member.presence?.status ?? 'offline';

  return {
    discordId: member.id,
    displayName: member.displayName ?? member.user.globalName ?? member.user.username,
    status: mapDiscordPresenceStatus(discordPresenceStatus),
    voiceChannelId: member.voice.channelId,
    voiceChannelName: member.voice.channel?.name ?? null,
    onlineSeconds,
    onlineSince: openSession?.startedAt?.toISOString() ?? null,
    collaborationActiveSeconds: voiceTotals?.collaborationSeconds ?? 0,
    inactiveSeconds: voiceTotals?.inactiveSeconds ?? 0,
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
): LiveVoiceTransitionEvent {
  return {
    organizationId: organizationId || String(transition.organizationId),
    guildId: transition.guildId,
    discordId: transition.discordId,
    displayName: transition.displayName,
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
 * Indica se o status bruto do Discord representa usuário ativo na dashboard.
 * @param status Status retornado pelo Discord.js
 * @returns true para online, idle ou dnd
 */
function isDiscordMemberActive(status: DiscordPresenceStatus): boolean {
  return status === 'online' || status === 'idle' || status === 'dnd';
}
