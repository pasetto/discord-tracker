import { config, VoiceSessionType } from '../config/env';

/**
 * Resultado da classificação de um canal de voz.
 */
export interface ChannelClassification {
  isIgnored: boolean;
  sessionType: VoiceSessionType;
}

/**
 * Verifica se um valor corresponde a um nome ou ID configurado (case-insensitive para nomes).
 * @param value Nome ou ID do canal
 * @param patterns Lista de nomes ou IDs configurados
 * @returns true se houver correspondência
 */
function matchesPattern(value: string, patterns: string[]): boolean {
  const normalized = value.toLowerCase();
  return patterns.some(
    (pattern) => pattern === value || pattern.toLowerCase() === normalized,
  );
}

/**
 * Classifica um canal de voz quanto a produtividade e tipo de sessão.
 * @param channelId ID do canal Discord
 * @param channelName Nome do canal Discord
 * @returns Classificação com flag ignored e sessionType
 * @example
 * classifyChannel('123', 'Almoço') // { isIgnored: true, sessionType: 'LUNCH' }
 */
export function classifyChannel(channelId: string, channelName: string): ChannelClassification {
  const allIgnored = [...config.ignoredChannels, ...config.afkChannelNames, ...config.lunchChannelNames];

  if (matchesPattern(channelId, config.ignoredChannels) || matchesPattern(channelName, config.ignoredChannels)) {
    if (matchesPattern(channelId, config.lunchChannelNames) || matchesPattern(channelName, config.lunchChannelNames)) {
      return { isIgnored: true, sessionType: 'LUNCH' };
    }
    if (matchesPattern(channelId, config.afkChannelNames) || matchesPattern(channelName, config.afkChannelNames)) {
      return { isIgnored: true, sessionType: 'AFK' };
    }
    return { isIgnored: true, sessionType: 'AFK' };
  }

  if (matchesPattern(channelId, config.lunchChannelNames) || matchesPattern(channelName, config.lunchChannelNames)) {
    return { isIgnored: true, sessionType: 'LUNCH' };
  }

  if (matchesPattern(channelId, config.afkChannelNames) || matchesPattern(channelName, config.afkChannelNames)) {
    return { isIgnored: true, sessionType: 'AFK' };
  }

  if (matchesPattern(channelId, allIgnored) || matchesPattern(channelName, allIgnored)) {
    return { isIgnored: true, sessionType: 'AFK' };
  }

  return { isIgnored: false, sessionType: 'VOICE' };
}

/**
 * Converte status Discord.js para status interno do sistema.
 * @param status Status bruto do Discord (pode ser null/undefined)
 * @returns Status normalizado
 */
export function mapDiscordPresenceStatus(status: string | null | undefined): import('../config/env').PresenceStatus {
  switch (status) {
    case 'online':
      return 'ONLINE';
    case 'idle':
      return 'IDLE';
    case 'dnd':
      return 'DND';
    case 'invisible':
      return 'INVISIBLE';
    default:
      return 'OFFLINE';
  }
}

/**
 * Converte segundos em horas com duas casas decimais.
 * @param seconds Total em segundos
 * @returns Horas formatadas
 */
export function secondsToHours(seconds: number): number {
  return Math.round((seconds / 3600) * 100) / 100;
}

export { getDayBounds, getMonthBounds, parseDateString, formatDateString, formatDateTime } from '../utils/timezone';
