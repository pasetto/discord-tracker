import { Events, VoiceState } from 'discord.js';
import { shouldRunBackgroundJobs } from '../../runtime/clusterRole';
import { discordClient } from '../client';
import { voiceService } from '../../services/voiceService';
import { createLogger } from '../../logger';

const log = createLogger('events:voice');

/**
 * Registra handler do evento voiceStateUpdate.
 */
export function registerVoiceStateUpdateHandler(): void {
  discordClient.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    if (!shouldRunBackgroundJobs()) {
      return;
    }

    try {
      await voiceService.handleVoiceStateUpdate(oldState, newState);
    } catch (error) {
      log.error({ err: error }, 'Erro ao processar voiceStateUpdate');
    }
  });
}
