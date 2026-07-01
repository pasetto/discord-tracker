import { config } from '../config/env';
import { checkDiscordHealth } from '../bot/client';
import { shouldRunBackgroundJobs } from '../runtime/clusterRole';

/** Mensagem padrão quando o bot Discord não está acessível. */
export const DISCORD_NOT_CONNECTED_MESSAGE =
  'Bot Discord não conectado. Verifique a configuração em Configurações → Discord.';

/**
 * Porta HTTP interna usada apenas pela instância com bot (PM2 instância 0).
 * Workers API-only encaminham operações Discord para este endpoint em localhost.
 * @returns Porta TCP exclusiva do processo bot
 */
export function getInternalDiscordPort(): number {
  const explicit = process.env.INTERNAL_DISCORD_PORT?.trim();
  if (explicit) {
    const parsed = Number.parseInt(explicit, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return config.port + 1000;
}

/**
 * Monta URL base do servidor interno Discord (somente instância bot).
 * @returns URL HTTP em localhost
 */
export function getInternalDiscordBaseUrl(): string {
  return `http://127.0.0.1:${getInternalDiscordPort()}`;
}

/**
 * Retorna a primeira API key configurada para chamadas internas.
 * @returns Chave de API ou string vazia em desenvolvimento sem chaves
 */
function getInternalApiKey(): string {
  return config.apiKeys[0] ?? '';
}

/**
 * Consulta saúde do bot na instância dedicada (PM2 instância 0).
 * @returns true quando o processo bot responde e o Discord está conectado
 */
export async function isDiscordBotInstanceReachable(): Promise<boolean> {
  const apiKey = getInternalApiKey();
  if (!apiKey) {
    return false;
  }

  try {
    const response = await fetch(`${getInternalDiscordBaseUrl()}/internal/discord/health`, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(3_000),
    });

    if (!response.ok) {
      return false;
    }

    const body = (await response.json()) as { discordConnected?: boolean };
    return body.discordConnected === true;
  } catch {
    return false;
  }
}

/**
 * Executa requisição HTTP autenticada ao servidor interno Discord.
 * @param path Caminho relativo (ex.: `/internal/discord/guilds/x/channels`)
 * @returns Corpo JSON parseado
 * @throws {Error} Quando a instância bot não responde ou retorna erro
 */
export async function callInternalDiscordApi<T>(path: string): Promise<T> {
  const apiKey = getInternalApiKey();
  if (!apiKey) {
    throw new Error(DISCORD_NOT_CONNECTED_MESSAGE);
  }

  let response: Response;
  try {
    response = await fetch(`${getInternalDiscordBaseUrl()}${path}`, {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error(DISCORD_NOT_CONNECTED_MESSAGE);
  }

  const body = (await response.json().catch(() => ({}))) as { error?: string };

  if (!response.ok) {
    throw new Error(body.error ?? DISCORD_NOT_CONNECTED_MESSAGE);
  }

  return body as T;
}

/**
 * Executa operação Discord no processo local (bot) ou via proxy interno (API-only).
 * @param params.guildId ID do servidor Discord
 * @param params.internalPath Caminho no servidor interno para workers API-only
 * @param params.onBotInstance Função executada quando este processo hospeda o bot
 * @returns Resultado da operação
 * @throws {Error} Quando o bot não está acessível
 */
export async function runWithDiscordBot<T>(params: {
  guildId: string;
  internalPath: string;
  onBotInstance: () => Promise<T>;
}): Promise<T> {
  // Preferência absoluta: servidor interno da instância bot (fonte única de verdade).
  if (await isDiscordBotInstanceReachable()) {
    return callInternalDiscordApi<T>(params.internalPath);
  }

  if (shouldRunBackgroundJobs()) {
    const { ensureDiscordGuildAccessible } = await import('../bot/client');
    if (!(await ensureDiscordGuildAccessible(params.guildId))) {
      throw new Error(DISCORD_NOT_CONNECTED_MESSAGE);
    }
    return params.onBotInstance();
  }

  throw new Error(DISCORD_NOT_CONNECTED_MESSAGE);
}

/**
 * Indica se o bot Discord está conectado neste processo ou na instância bot do cluster.
 * @returns true quando o gateway está operacional para operações de guild
 */
export async function resolveDiscordBotConnected(): Promise<boolean> {
  if (shouldRunBackgroundJobs()) {
    return checkDiscordHealth();
  }
  return isDiscordBotInstanceReachable();
}
