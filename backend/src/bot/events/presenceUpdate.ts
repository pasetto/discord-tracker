import { Events, GuildMember, Presence } from 'discord.js';
import { discordClient } from '../client';
import { presenceService } from '../../services/presenceService';
import { createLogger } from '../../logger';

const log = createLogger('events:presence');

/**
 * Registra handler do evento presenceUpdate.
 */
export function registerPresenceUpdateHandler(): void {
  discordClient.on(Events.PresenceUpdate, async (_oldPresence: Presence | null, newPresence: Presence) => {
    try {
      await presenceService.handlePresenceUpdate(_oldPresence, newPresence);
    } catch (error) {
      log.error({ err: error }, 'Erro ao processar presenceUpdate');
    }
  });
}

/**
 * Inicializa presença de todos os membros não-bot ao conectar.
 * @param members Membros do guild monitorado
 */
export async function seedInitialPresence(members: GuildMember[]): Promise<void> {
  for (const member of members) {
    if (member.user.bot) continue;

    const presence = member.presence;
    if (presence) {
      try {
        await presenceService.handlePresenceUpdate(null, presence);
      } catch (error) {
        log.error({ err: error, memberId: member.id }, 'Erro ao seed presença inicial');
      }
    }
  }
}
