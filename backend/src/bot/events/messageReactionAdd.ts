import { Events, MessageReaction, User } from 'discord.js';
import { discordClient } from '../client';
import { createLogger } from '../../logger';
import { guildService } from '../../services/guildService';
import { textActivityService } from '../../services/textActivityService';

const log = createLogger('events:message-reaction-add');

/**
 * Registra handler do evento messageReactionAdd.
 */
export function registerMessageReactionAddHandler(): void {
  discordClient.on(
    Events.MessageReactionAdd,
    async (reaction: MessageReaction, user: User) => {
      try {
        if (user.bot) {
          return;
        }

        if (reaction.partial) {
          await reaction.fetch();
        }

        const guildId = reaction.message.guildId;
        if (!guildService.isMonitoredGuild(guildId)) {
          return;
        }
        if (!guildId) {
          return;
        }

        await textActivityService.recordActivity({
          guildId,
          discordId: user.id,
          channelId: reaction.message.channelId,
          eventType: 'reaction',
          occurredAt: new Date(),
        });
      } catch (error) {
        log.error({ err: error }, 'Erro ao processar messageReactionAdd');
      }
    },
  );
}
