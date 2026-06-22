import { VoiceSessionType } from '../config/env';
import type { ChannelRuleSet, ChannelSelection } from '../db/models/ChannelRule';

/**
 * Resultado da classificação de um canal de voz.
 */
export interface ChannelClassification {
  isIgnored: boolean;
  sessionType: VoiceSessionType;
}

/**
 * Verifica se canal corresponde a uma lista de seleções.
 * @param channelId ID do canal Discord
 * @param channelName Nome do canal Discord
 * @param selections Lista de canais selecionados na UI
 * @returns true se houver correspondência
 */
function matchesSelection(
  channelId: string,
  channelName: string,
  selections: ChannelSelection[],
): boolean {
  const normalizedName = channelName.toLowerCase();
  return selections.some(
    (selection) =>
      selection.channelId === channelId || selection.channelName.toLowerCase() === normalizedName,
  );
}

/**
 * Classifica um canal de voz usando regras persistidas no banco.
 * @param channelId ID do canal Discord
 * @param channelName Nome do canal Discord
 * @param rules Regras do guild carregadas da collection ChannelRule
 * @returns Classificação com flag ignored e sessionType
 * @example
 * classifyVoiceChannel('123', 'Almoço', rules) // { isIgnored: true, sessionType: 'LUNCH' }
 */
export function classifyVoiceChannel(
  channelId: string,
  channelName: string,
  rules: ChannelRuleSet,
): ChannelClassification {
  if (matchesSelection(channelId, channelName, rules.lunch)) {
    return { isIgnored: true, sessionType: 'LUNCH' };
  }

  if (
    matchesSelection(channelId, channelName, rules.afk) ||
    matchesSelection(channelId, channelName, rules.ignored)
  ) {
    return { isIgnored: true, sessionType: 'AFK' };
  }

  if (rules.productiveVoice.length > 0 && !matchesSelection(channelId, channelName, rules.productiveVoice)) {
    return { isIgnored: true, sessionType: 'AFK' };
  }

  return { isIgnored: false, sessionType: 'VOICE' };
}

/**
 * Indica se um canal de texto é colaborativo para sinais de atividade.
 * @param channelId ID do canal de texto
 * @param rules Regras do guild carregadas da collection ChannelRule
 * @returns true quando o canal deve contar como atividade colaborativa
 */
export function classifyTextChannel(channelId: string, rules: ChannelRuleSet): boolean {
  const isIgnoredText = rules.ignoredText.some((selection) => selection.channelId === channelId);
  if (isIgnoredText) {
    return false;
  }

  return rules.productiveText.some((selection) => selection.channelId === channelId);
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
