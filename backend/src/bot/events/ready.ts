import { registerDiscordReadyHandler } from '../client';
import { createLogger } from '../../logger';
import { recoverSessions } from '../recovery/sessionRecovery';
import { registerPresenceUpdateHandler, seedInitialPresence } from './presenceUpdate';
import { registerVoiceStateUpdateHandler } from './voiceStateUpdate';
import { reportService } from '../../services/reportService';
import { guildService } from '../../services/guildService';

const log = createLogger('events:ready');

/**
 * Registra handler do evento ready e inicializa subsistemas.
 */
export function registerReadyHandler(): void {
  registerPresenceUpdateHandler();
  registerVoiceStateUpdateHandler();

  registerDiscordReadyHandler(async () => {
    await guildService.initialize();

    const guild = guildService.getTargetGuild();

    if (!guild) {
      log.warn('Nenhum guild encontrado para monitoramento');
      return;
    }

    log.info({ guildId: guild.id, guildName: guild.name }, 'Iniciando monitoramento do guild');

    try {
      await guild.members.fetch();
      await recoverSessions(guild);
      await seedInitialPresence([...guild.members.cache.values()]);

      await reportService.generateDailyReports(new Date());

      log.info('Bot pronto e sessões recuperadas');
    } catch (error) {
      log.error({ err: error }, 'Erro na inicialização pós-ready');
    }
  });
}
