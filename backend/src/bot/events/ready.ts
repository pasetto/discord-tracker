import { registerDiscordReadyHandler, discordClient } from '../client';
import { createLogger } from '../../logger';
import { recoverSessions } from '../recovery/sessionRecovery';
import { registerPresenceUpdateHandler, seedInitialPresence } from './presenceUpdate';
import { registerVoiceStateUpdateHandler } from './voiceStateUpdate';
import { registerGuildMembersHandlers } from './guildMembers';
import { reportService } from '../../services/reportService';
import { guildService } from '../../services/guildService';
import { listEnabledMonitoredGuilds } from '../../services/guildMonitoringService';
import { syncTrackedUsersFromDiscordGuild } from '../../services/trackedUserService';
import {
  cleanupDuplicateOpenPresenceSessions,
  cleanupDuplicateOpenVoiceSessions,
} from '../../services/sessionLegacyCleanupService';

const log = createLogger('events:ready');

/**
 * Registra handler do evento ready e inicializa subsistemas.
 */
export function registerReadyHandler(): void {
  registerPresenceUpdateHandler();
  registerVoiceStateUpdateHandler();
  registerGuildMembersHandlers();

  registerDiscordReadyHandler(async () => {
    await guildService.initialize();

    const monitoredGuilds = await listEnabledMonitoredGuilds();
    const legacyGuild = guildService.getTargetGuild();
    const guildIdsToSeed = new Set(monitoredGuilds.map((entry) => entry.guildId));
    if (legacyGuild) {
      guildIdsToSeed.add(legacyGuild.id);
    }

    if (guildIdsToSeed.size === 0) {
      log.warn('Nenhum guild encontrado para monitoramento');
      return;
    }

    for (const guildId of guildIdsToSeed) {
      const guild = discordClient.guilds.cache.get(guildId);
      if (!guild) {
        log.warn({ guildId }, 'Guild monitorado não encontrado no cache do bot');
        continue;
      }

      log.info({ guildId: guild.id, guildName: guild.name }, 'Iniciando monitoramento do guild');

      try {
        const monitored = monitoredGuilds.find((entry) => entry.guildId === guild.id);
        if (monitored) {
          await syncTrackedUsersFromDiscordGuild(monitored.organizationId, guild.id, { skipReadyCheck: true });
        }
        await recoverSessions(guild);
        await seedInitialPresence([...guild.members.cache.values()]);

        if (monitored) {
          await cleanupDuplicateOpenVoiceSessions({
            apply: true,
            organizationId: monitored.organizationId,
            guildId: guild.id,
          });
          await cleanupDuplicateOpenPresenceSessions({
            apply: true,
            organizationId: monitored.organizationId,
            guildId: guild.id,
          });
        }
      } catch (error) {
        log.error({ err: error, guildId }, 'Erro ao inicializar guild monitorado');
      }
    }

    try {
      await reportService.generateDailyReports(new Date());
      log.info('Bot pronto e sessões recuperadas');
    } catch (error) {
      log.error({ err: error }, 'Erro na geração de relatórios pós-ready');
    }
  });
}
