import { ChannelType } from 'discord.js';
import { discordClient } from '../bot/client';
import { runWithDiscordBot } from './discordClusterProxy';

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
 *
 * Em cluster PM2, encaminha para a instância bot quando este worker é API-only.
 * @param guildId ID do servidor Discord monitorado
 * @returns Canais ordenados por nome para exibição na UI
 * @throws {Error} Quando o bot não está conectado ou não está no servidor
 */
export async function listGuildDiscordChannels(guildId: string): Promise<DiscordGuildChannelOption[]> {
  const result = await runWithDiscordBot({
    guildId,
    internalPath: `/internal/discord/guilds/${guildId}/channels`,
    onBotInstance: () => listGuildDiscordChannelsOnBotInstance(guildId),
  });

  return unwrapDiscordChannelsResponse(result);
}

/**
 * Normaliza resposta de canais vindas do proxy interno ou da instância bot.
 * @param result Lista direta ou envelope `{ channels }` do servidor interno
 * @returns Lista de canais para a API pública
 */
export function unwrapDiscordChannelsResponse(
  result: DiscordGuildChannelOption[] | { channels: DiscordGuildChannelOption[] },
): DiscordGuildChannelOption[] {
  return Array.isArray(result) ? result : result.channels;
}

/**
 * Lista canais no processo que hospeda o bot Discord (sem proxy de cluster).
 * @param guildId ID do servidor Discord monitorado
 * @returns Canais ordenados por nome para exibição na UI
 * @throws {Error} Quando o guild não existe para o bot
 */
export async function listGuildDiscordChannelsOnBotInstance(
  guildId: string,
): Promise<DiscordGuildChannelOption[]> {
  let guild = discordClient.guilds.cache.get(guildId);
  if (!guild) {
    try {
      guild = await discordClient.guilds.fetch(guildId);
    } catch {
      throw new Error('Bot não encontrou este servidor. Adicione o bot ao servidor e selecione-o novamente.');
    }
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
