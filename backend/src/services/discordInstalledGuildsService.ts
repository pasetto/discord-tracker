import { discordClient } from '../bot/client';
import { shouldRunBackgroundJobs } from '../runtime/clusterRole';
import {
  callInternalDiscordApi,
  DISCORD_NOT_CONNECTED_MESSAGE,
  isDiscordBotInstanceReachable,
} from './discordClusterProxy';

/**
 * Resumo de servidor Discord onde o bot está instalado (formato da API tenant).
 */
export interface InstalledDiscordGuildSummary {
  /** ID do servidor Discord. */
  guildId: string;
  /** Nome do servidor. */
  guildName: string;
  /** Total de membros reportado pelo Discord. */
  memberCount: number;
  /** URL do ícone, quando existir. */
  iconUrl?: string;
}

/**
 * Monta URL pública do ícone de um guild a partir do hash do Discord.
 * @param guildId ID do servidor
 * @param iconHash Hash do ícone ou null/undefined
 * @returns URL CDN ou undefined
 */
function buildGuildIconUrl(guildId: string, iconHash: string | null | undefined): string | undefined {
  if (!iconHash) {
    return undefined;
  }
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png`;
}

/**
 * Converte guild do cache Discord.js para o resumo da API.
 * @param guild Guild com id/name/memberCount/icon
 * @returns Resumo serializável
 */
function toInstalledSummary(guild: {
  id: string;
  name: string;
  memberCount: number;
  icon: string | null;
}): InstalledDiscordGuildSummary {
  return {
    guildId: guild.id,
    guildName: guild.name,
    memberCount: guild.memberCount,
    iconUrl: buildGuildIconUrl(guild.id, guild.icon),
  };
}

/**
 * Lista servidores onde o bot está presente neste processo (instância bot).
 * @returns Resumos ordenados por nome
 */
export function listInstalledGuildSummariesOnBotInstance(): InstalledDiscordGuildSummary[] {
  if (!discordClient.isReady()) {
    return [];
  }

  return [...discordClient.guilds.cache.values()]
    .map((guild) => toInstalledSummary(guild))
    .sort((left, right) => left.guildName.localeCompare(right.guildName, 'pt-BR'));
}

/**
 * Obtém um servidor do cache/fetch local da instância bot.
 * @param guildId ID do servidor Discord
 * @returns Resumo ou null quando ausente
 */
export async function getInstalledGuildSummaryOnBotInstance(
  guildId: string,
): Promise<InstalledDiscordGuildSummary | null> {
  let guild = discordClient.guilds.cache.get(guildId);
  if (!guild) {
    try {
      guild = await discordClient.guilds.fetch(guildId);
    } catch {
      return null;
    }
  }

  return toInstalledSummary(guild);
}

/**
 * Lista servidores instalados, usando proxy interno em workers API-only.
 * @returns Resumos de guilds visíveis ao bot
 * @throws {Error} Quando o bot Discord não está acessível
 */
export async function listInstalledGuildSummaries(): Promise<InstalledDiscordGuildSummary[]> {
  if (await isDiscordBotInstanceReachable()) {
    const body = await callInternalDiscordApi<{ guilds: InstalledDiscordGuildSummary[] }>(
      '/internal/discord/guilds',
    );
    return body.guilds ?? [];
  }

  if (shouldRunBackgroundJobs()) {
    return listInstalledGuildSummariesOnBotInstance();
  }

  throw new Error(DISCORD_NOT_CONNECTED_MESSAGE);
}

/**
 * Obtém um servidor instalado, usando proxy interno em workers API-only.
 * @param guildId ID do servidor Discord
 * @returns Resumo ou null
 * @throws {Error} Quando o bot Discord não está acessível
 */
export async function getInstalledGuildSummary(
  guildId: string,
): Promise<InstalledDiscordGuildSummary | null> {
  if (await isDiscordBotInstanceReachable()) {
    try {
      const body = await callInternalDiscordApi<{ guild: InstalledDiscordGuildSummary }>(
        `/internal/discord/guilds/${guildId}`,
      );
      return body.guild ?? null;
    } catch (error) {
      const message = (error as Error).message ?? '';
      if (/não encontrado|not found|404/i.test(message)) {
        return null;
      }
      throw error;
    }
  }

  if (shouldRunBackgroundJobs()) {
    return getInstalledGuildSummaryOnBotInstance(guildId);
  }

  throw new Error(DISCORD_NOT_CONNECTED_MESSAGE);
}

/**
 * Conta servidores no cache do bot (local ou via health interno).
 * @returns Quantidade de guilds ou 0 se bot inacessível
 */
export async function resolveInstalledGuildCount(): Promise<number> {
  if (await isDiscordBotInstanceReachable()) {
    const body = await callInternalDiscordApi<{ guildCount?: number }>('/internal/discord/health');
    return typeof body.guildCount === 'number' ? body.guildCount : 0;
  }

  if (shouldRunBackgroundJobs() && discordClient.isReady()) {
    return discordClient.guilds.cache.size;
  }

  return 0;
}
