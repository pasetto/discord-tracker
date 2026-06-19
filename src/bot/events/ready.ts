import { Guild } from 'discord.js';
import { discordClient } from '../client';
import { config } from '../../config/env';
import { createLogger } from '../../logger';
import { recoverSessions } from '../recovery/sessionRecovery';
import { registerPresenceUpdateHandler } from './presenceUpdate';
import { registerVoiceStateUpdateHandler } from './voiceStateUpdate';
import { reportService } from '../../services/reportService';

const log = createLogger('events:ready');

/**
 * Obtém o guild principal configurado ou o primeiro disponível.
 * @returns Guild monitorado ou undefined
 */
function getTargetGuild(): Guild | undefined {
  if (config.discordGuildId) {
    return discordClient.guilds.cache.get(config.discordGuildId);
  }
  return discordClient.guilds.cache.first();
}

/**
 * Registra handler do evento ready e inicializa subsistemas.
 */
export function registerReadyHandler(): void {
  registerPresenceUpdateHandler();
  registerVoiceStateUpdateHandler();

  discordClient.once('ready', async () => {
    const guild = getTargetGuild();

    if (!guild) {
      log.warn('Nenhum guild encontrado para monitoramento');
      return;
    }

    log.info({ guildId: guild.id, guildName: guild.name }, 'Iniciando monitoramento do guild');

    try {
      await guild.members.fetch();
      await recoverSessions(guild);

      // Gera relatório do dia ao iniciar (atualiza métricas parciais)
      await reportService.generateDailyReports(new Date());

      log.info('Bot pronto e sessões recuperadas');
    } catch (error) {
      log.error({ err: error }, 'Erro na inicialização pós-ready');
    }
  });
}
