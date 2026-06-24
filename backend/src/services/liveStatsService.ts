import { checkDiscordHealth } from '../bot/client';
import { guildService } from './guildService';
import { formatDateTime } from '../utils/timezone';
import { config } from '../config/env';

/** Usuário online detectado em tempo real. */
export interface LiveOnlineUser {
  username: string;
  displayName: string;
  status: string;
}

/** Usuário em canal de voz detectado em tempo real. */
export interface LiveVoiceUser {
  username: string;
  displayName: string;
  channelName: string;
}

/** Snapshot de dados ao vivo do Discord para o dashboard. */
export interface LiveSnapshot {
  timestamp: string;
  timezone: string;
  discordConnected: boolean;
  selectedGuildId: string | null;
  selectedGuildName: string | null;
  onlineUsers: LiveOnlineUser[];
  voiceUsers: LiveVoiceUser[];
}

/**
 * Coleta presença e voz em tempo real do guild monitorado.
 * Usa o cache de membros, mais confiável que presences.cache isolado.
 * @returns Snapshot atual ou listas vazias quando indisponível
 */
export async function collectLiveSnapshot(): Promise<LiveSnapshot> {
  await guildService.ensureInitialized();

  const base: LiveSnapshot = {
    timestamp: formatDateTime(new Date()),
    timezone: config.timezone,
    discordConnected: checkDiscordHealth(),
    selectedGuildId: guildService.getSelectedGuildId(),
    selectedGuildName: guildService.getTargetGuild()?.name ?? null,
    onlineUsers: [],
    voiceUsers: [],
  };

  if (!checkDiscordHealth()) {
    return base;
  }

  const guild = guildService.getTargetGuild();
  if (!guild) {
    return base;
  }

  for (const [, member] of guild.members.cache) {
    if (member.user.bot) {
      continue;
    }

    const status = member.presence?.status;
    if (status && status !== 'offline' && status !== 'invisible') {
      base.onlineUsers.push({
        username: member.user.username,
        displayName: member.displayName,
        status,
      });
    }

    if (member.voice.channel) {
      base.voiceUsers.push({
        username: member.user.username,
        displayName: member.displayName,
        channelName: member.voice.channel.name,
      });
    }
  }

  base.onlineUsers.sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
  base.voiceUsers.sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));

  return base;
}
