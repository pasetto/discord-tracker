import { Events, MessageReaction, PartialMessageReaction, PartialUser, User } from 'discord.js';
import { shouldRunBackgroundJobs } from '../../runtime/clusterRole';
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
    async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
      if (!shouldRunBackgroundJobs()) {
        return;
      }

      try {
        if (user.bot) {
          return;
        }

        const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
        const guildId = fullReaction.message.guildId;
        if (!guildService.isMonitoredGuild(guildId)) {
          return;
        }
        if (!guildId) {
          return;
        }

        await textActivityService.recordActivity({
          guildId,
          discordId: user.id,
          channelId: fullReaction.message.channelId,
          eventType: 'reaction',
          occurredAt: new Date(),
        });
      } catch (error) {
        log.error({ err: error }, 'Erro ao processar messageReactionAdd');
      }
    },
  );
}
