import dotenv from 'dotenv';

dotenv.config();

/**
 * Tipos de sessão de voz suportados pelo sistema.
 */
export type VoiceSessionType = 'VOICE' | 'AFK' | 'LUNCH';

/**
 * Status de presença monitorados pelo bot.
 */
export type PresenceStatus = 'ONLINE' | 'IDLE' | 'DND' | 'OFFLINE' | 'INVISIBLE';

/**
 * Tipos de evento de voz registrados.
 */
export type VoiceEventType =
  | 'JOIN'
  | 'LEAVE'
  | 'SWITCH'
  | 'MOVED'
  | 'AFK_AUTO'
  | 'RECONNECT'
  | 'DISCONNECT';

/**
 * Configuração centralizada da aplicação carregada das variáveis de ambiente.
 */
export interface AppConfig {
  discordToken: string;
  discordGuildId: string;
  mongodbUri: string;
  port: number;
  host: string;
  ignoredChannels: string[];
  afkChannelNames: string[];
  lunchChannelNames: string[];
  logLevel: string;
  nodeEnv: string;
  timezone: string;
  apiKeys: string[];
}

/**
 * Converte uma string separada por vírgulas em array trimado.
 * @param value Valor bruto da variável de ambiente
 * @param fallback Valores padrão quando vazio
 * @returns Lista de strings normalizadas
 */
function parseList(value: string | undefined, fallback: string[]): string[] {
  if (!value?.trim()) {
    return fallback;
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

/**
 * Carrega e valida a configuração da aplicação.
 * @returns Objeto de configuração tipado
 * @throws {Error} Quando variáveis obrigatórias estão ausentes
 */
export function loadConfig(): AppConfig {
  const discordToken = process.env.DISCORD_TOKEN;
  const mongodbUri = process.env.MONGODB_URI;

  if (!discordToken) {
    throw new Error('DISCORD_TOKEN é obrigatório');
  }
  if (!mongodbUri) {
    throw new Error('MONGODB_URI é obrigatório');
  }

  const apiKeys = parseList(process.env.API_KEYS, []);
  if (apiKeys.length === 0) {
    throw new Error('API_KEYS é obrigatório (uma ou mais chaves separadas por vírgula)');
  }

  return {
    discordToken,
    discordGuildId: process.env.DISCORD_GUILD_ID ?? '',
    mongodbUri,
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? '0.0.0.0',
    ignoredChannels: parseList(process.env.IGNORED_CHANNELS, ['AFK', 'Almoço']),
    afkChannelNames: parseList(process.env.AFK_CHANNEL_NAMES, ['AFK', 'afk']),
    lunchChannelNames: parseList(process.env.LUNCH_CHANNEL_NAMES, ['Almoço', 'Almoco', 'Lunch']),
    logLevel: process.env.LOG_LEVEL ?? 'info',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    timezone: process.env.TIMEZONE ?? 'America/Sao_Paulo',
    apiKeys,
  };
}

/** Instância singleton da configuração. */
export const config = loadConfig();
