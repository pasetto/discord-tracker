import { GuildConnectionModel } from '../db/models/GuildConnection';
import { guildService } from './guildService';

/** Contexto multitenant de um guild monitorado. */
export interface MonitoredGuildContext {
  organizationId: string;
  guildId: string;
  guildName: string;
}

type GuildConnectionLean = {
  organizationId: unknown;
  guildId: string;
  guildName: string;
  isMonitoringEnabled?: boolean;
};

/**
 * Busca conexão de guild priorizando monitoramento habilitado.
 * @param guildId ID do servidor Discord
 * @returns Documento lean ou null
 */
async function findGuildConnection(guildId: string): Promise<GuildConnectionLean | null> {
  const enabled = await GuildConnectionModel.findOne({
    guildId,
    isActive: true,
    isMonitoringEnabled: true,
  })
    .select('organizationId guildId guildName isMonitoringEnabled')
    .lean<GuildConnectionLean>()
    .exec();

  if (enabled) {
    return enabled;
  }

  return GuildConnectionModel.findOne({
    guildId,
    isActive: true,
  })
    .select('organizationId guildId guildName isMonitoringEnabled')
    .lean<GuildConnectionLean>()
    .exec();
}

/**
 * Resolve guild monitorado ativo a partir do ID Discord.
 * @param guildId ID do servidor Discord
 * @returns Contexto da organização ou null quando não monitorado
 */
export async function resolveMonitoredGuild(guildId: string | null | undefined): Promise<MonitoredGuildContext | null> {
  if (!guildId?.trim()) {
    return null;
  }

  const normalizedGuildId = guildId.trim();
  const connection = await findGuildConnection(normalizedGuildId);

  if (connection) {
    return {
      organizationId: String(connection.organizationId),
      guildId: connection.guildId,
      guildName: connection.guildName,
    };
  }

  if (!guildService.isMonitoredGuild(normalizedGuildId)) {
    return null;
  }

  const legacyConnection = await GuildConnectionModel.findOne({ guildId: normalizedGuildId })
    .select('organizationId guildId guildName')
    .lean<GuildConnectionLean>()
    .exec();

  if (legacyConnection) {
    return {
      organizationId: String(legacyConnection.organizationId),
      guildId: legacyConnection.guildId,
      guildName: legacyConnection.guildName,
    };
  }

  return null;
}

/**
 * Indica se o guild possui monitoramento ativo configurado na plataforma.
 * @param guildId ID do servidor Discord
 * @returns true quando há conexão ativa ou guild legado selecionado
 */
export async function isMonitoredGuild(guildId: string | null | undefined): Promise<boolean> {
  const context = await resolveMonitoredGuild(guildId);
  return context !== null;
}

/**
 * Lista guilds com monitoramento habilitado para inicialização do bot.
 * @returns Conexões ativas com monitoramento ligado
 */
export async function listEnabledMonitoredGuilds(): Promise<MonitoredGuildContext[]> {
  const connections = await GuildConnectionModel.find({
    isActive: true,
    isMonitoringEnabled: true,
  })
    .select('organizationId guildId guildName')
    .lean<GuildConnectionLean[]>()
    .exec();

  return connections.map((connection) => ({
    organizationId: String(connection.organizationId),
    guildId: connection.guildId,
    guildName: connection.guildName,
  }));
}
