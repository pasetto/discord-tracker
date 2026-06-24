import { Types } from 'mongoose';
import { GuildConnectionModel } from '../db/models/GuildConnection';

/**
 * Garante que o guild informado está monitorado pela organização do tenant.
 * @param organizationId ID da organização autenticada
 * @param guildId ID do servidor Discord
 * @throws {Error} Quando não há conexão ativa org↔guild
 */
export async function assertGuildMonitoredByOrganization(organizationId: string, guildId: string): Promise<void> {
  const connection = await GuildConnectionModel.findOne({
    organizationId: new Types.ObjectId(organizationId),
    guildId,
    isActive: true,
    isMonitoringEnabled: true,
  })
    .select('_id')
    .lean()
    .exec();

  if (!connection) {
    throw new Error('Servidor Discord não monitorado para esta organização');
  }
}
