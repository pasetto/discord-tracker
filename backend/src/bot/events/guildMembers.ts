import { discordClient } from '../client';
import { createLogger } from '../../logger';
import { listEnabledMonitoredGuilds } from '../../services/guildMonitoringService';
import {
  deactivateTrackedUserByDiscordId,
  reactivateTrackedUserByDiscordId,
  upsertTrackedUser,
} from '../../services/trackedUserService';

const log = createLogger('events:guildMembers');

/**
 * Resolve organização tenant associada a um guild monitorado.
 * @param guildId ID do servidor Discord
 * @returns organizationId quando o guild estiver monitorado
 */
async function resolveMonitoredOrganizationId(guildId: string): Promise<string | undefined> {
  const monitoredGuilds = await listEnabledMonitoredGuilds();
  return monitoredGuilds.find((entry) => entry.guildId === guildId)?.organizationId;
}

/**
 * Registra handlers de entrada e saída de membros para manter `tracked_users` sincronizado.
 */
export function registerGuildMembersHandlers(): void {
  discordClient.on('guildMemberRemove', async (member) => {
    if (member.user.bot) {
      return;
    }

    const organizationId = await resolveMonitoredOrganizationId(member.guild.id);
    if (!organizationId) {
      return;
    }

    const deactivated = await deactivateTrackedUserByDiscordId(organizationId, member.guild.id, member.id);
    if (deactivated) {
      log.info({ guildId: member.guild.id, discordId: member.id }, 'Membro desativado do rastreamento');
    }
  });

  discordClient.on('guildMemberAdd', async (member) => {
    if (member.user.bot) {
      return;
    }

    const organizationId = await resolveMonitoredOrganizationId(member.guild.id);
    if (!organizationId) {
      return;
    }

    const reactivated = await reactivateTrackedUserByDiscordId(organizationId, member.guild.id, member.id);
    if (reactivated) {
      log.info({ guildId: member.guild.id, discordId: member.id }, 'Membro reativado no rastreamento');
      return;
    }

    await upsertTrackedUser({
      organizationId,
      guildId: member.guild.id,
      discordId: member.id,
      username: member.user.username,
      displayName: member.displayName ?? member.user.globalName ?? member.user.username,
    });
  });
}
