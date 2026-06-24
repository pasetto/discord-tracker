import { ChannelType } from 'discord.js';
import { discordClient, isDiscordReady } from '../bot/client';

/** Canal Discord disponível para seleção na UI de regras. */
export interface DiscordGuildChannelOption {
  channelId: string;
  channelName: string;
  channelType: 'voice' | 'text';
  parentName?: string;
}

const VOICE_CHANNEL_TYPES = new Set<number>([ChannelType.GuildVoice, ChannelType.GuildStageVoice]);
const TEXT_CHANNEL_TYPES = new Set<number>([ChannelType.GuildText, ChannelType.GuildAnnouncement]);

/**
 * Lista canais de voz e texto do servidor onde o bot está presente.
 * @param guildId ID do servidor Discord monitorado
 * @returns Canais ordenados por nome para exibição na UI
 * @throws {Error} Quando o bot não está conectado ou não está no servidor
 */
export function listGuildDiscordChannels(guildId: string): DiscordGuildChannelOption[] {
  if (!isDiscordReady) {
    throw new Error('Bot Discord não conectado. Verifique a configuração em Configurações → Discord.');
  }

  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) {
    throw new Error('Bot não encontrou este servidor. Adicione o bot ao servidor e selecione-o novamente.');
  }

  return [...guild.channels.cache.values()]
    .filter((channel) => VOICE_CHANNEL_TYPES.has(channel.type) || TEXT_CHANNEL_TYPES.has(channel.type))
    .map((channel) => ({
      channelId: channel.id,
      channelName: channel.name,
      channelType: VOICE_CHANNEL_TYPES.has(channel.type) ? ('voice' as const) : ('text' as const),
      parentName: channel.parent?.name,
    }))
    .sort((left, right) => left.channelName.localeCompare(right.channelName, 'pt-BR'));
}
