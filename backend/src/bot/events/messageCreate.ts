import { Events, Message } from 'discord.js';
import { shouldRunBackgroundJobs } from '../../runtime/clusterRole';
import { discordClient } from '../client';
import { createLogger } from '../../logger';
import { guildService } from '../../services/guildService';
import { textActivityService } from '../../services/textActivityService';

const log = createLogger('events:message-create');

/**
 * Resolve o tipo de evento textual para mensagens novas.
 * @param message Mensagem recebida
 * @returns Tipo de evento textual correspondente
 */
function resolveTextEventType(message: Message): 'message' | 'thread_reply' {
  return message.channel?.isThread() ? 'thread_reply' : 'message';
}

/**
 * Registra handler do evento messageCreate.
 */
export function registerMessageCreateHandler(): void {
  discordClient.on(Events.MessageCreate, async (message: Message) => {
    if (!shouldRunBackgroundJobs()) {
      return;
    }

    try {
      if (message.author.bot) {
        return;
      }

      const guildId = message.guildId;
      if (!guildService.isMonitoredGuild(guildId)) {
        return;
      }
      if (!guildId) {
        return;
      }

      await textActivityService.recordActivity({
        guildId,
        discordId: message.author.id,
        channelId: message.channelId,
        eventType: resolveTextEventType(message),
        occurredAt: message.createdAt,
      });
    } catch (error) {
      log.error({ err: error }, 'Erro ao processar messageCreate');
    }
  });
}
