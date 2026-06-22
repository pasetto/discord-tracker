import Router from '@koa/router';
import { Types } from 'mongoose';
import { discordClient, isDiscordReady } from '../../bot/client';
import { GuildConnectionModel } from '../../db/models/GuildConnection';
import type { AuthUserPayload } from '../../services/authService';

const ADMIN_ROLES = new Set(['owner', 'admin']);

/** Rotas de configuração Discord por organização (guild monitorado). */
export const discordSettingsRouter = new Router();

/**
 * Obtém role do usuário autenticado na organização atual.
 * @param ctx Contexto Koa da requisição
 * @param organizationId Organização do tenant
 * @returns Papel normalizado ou `undefined`
 */
function getMembershipRole(ctx: Router.RouterContext, organizationId: string): string | undefined {
  const user = ctx.state.user as AuthUserPayload | undefined;
  const membership = user?.memberships?.find((item) => item.organizationId === organizationId);
  return membership?.role?.toLowerCase();
}

/**
 * Garante permissão de admin/owner para alterar conexão Discord.
 * @param ctx Contexto Koa da requisição
 * @param organizationId Organização do tenant
 */
function assertAdminRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !ADMIN_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para configurar Discord');
  }
}

/**
 * @openapi
 * /org/{orgId}/discord/status:
 *   get:
 *     tags:
 *       - Discord
 *     summary: Status do bot e conexão da organização
 */
discordSettingsRouter.get('/discord/status', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente' };
    return;
  }

  const activeConnection = await GuildConnectionModel.findOne({
    organizationId: new Types.ObjectId(organizationId),
    isActive: true,
    isMonitoringEnabled: true,
  })
    .lean()
    .exec();

  ctx.body = {
    botConnected: isDiscordReady,
    guildCount: discordClient.isReady() ? discordClient.guilds.cache.size : 0,
    activeConnection: activeConnection
      ? {
          guildId: activeConnection.guildId,
          guildName: activeConnection.guildName,
          iconUrl: activeConnection.iconUrl,
          isMonitoringEnabled: activeConnection.isMonitoringEnabled,
        }
      : null,
  };
});

/**
 * @openapi
 * /org/{orgId}/discord/guilds:
 *   get:
 *     tags:
 *       - Discord
 *     summary: Lista servidores onde o bot está instalado
 */
discordSettingsRouter.get('/discord/guilds', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente' };
    return;
  }

  if (!isDiscordReady) {
    ctx.status = 503;
    ctx.body = {
      error: 'Bot Discord não conectado',
      message: 'Cadastre o bot em /admin/discord antes de listar servidores',
    };
    return;
  }

  const guilds = [...discordClient.guilds.cache.values()].map((guild) => ({
    guildId: guild.id,
    guildName: guild.name,
    iconUrl: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : undefined,
    memberCount: guild.memberCount,
  }));

  ctx.body = { guilds };
});

/**
 * @openapi
 * /org/{orgId}/discord/guilds/{guildId}/select:
 *   post:
 *     tags:
 *       - Discord
 *     summary: Seleciona servidor monitorado da organização
 */
discordSettingsRouter.post('/discord/guilds/:guildId/select', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  const guildId = ctx.params.guildId;
  const user = ctx.state.user as AuthUserPayload | undefined;

  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente' };
    return;
  }

  assertAdminRole(ctx, organizationId);

  if (!isDiscordReady) {
    ctx.status = 503;
    ctx.body = { error: 'Bot Discord não conectado' };
    return;
  }

  const guild = discordClient.guilds.cache.get(guildId);
  if (!guild) {
    ctx.status = 404;
    ctx.body = { error: 'Servidor não encontrado para o bot atual' };
    return;
  }

  await GuildConnectionModel.updateMany(
    { organizationId: new Types.ObjectId(organizationId) },
    { isMonitoringEnabled: false },
  );

  const connection = await GuildConnectionModel.findOneAndUpdate(
    {
      organizationId: new Types.ObjectId(organizationId),
      guildId,
    },
    {
      organizationId: new Types.ObjectId(organizationId),
      guildId,
      guildName: guild.name,
      iconUrl: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : undefined,
      botInstalledAt: new Date(),
      isActive: true,
      isMonitoringEnabled: true,
      selectedAt: new Date(),
      selectedBy: user?.id && Types.ObjectId.isValid(user.id) ? new Types.ObjectId(user.id) : undefined,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();

  ctx.body = {
    connection: {
      guildId: connection.guildId,
      guildName: connection.guildName,
      iconUrl: connection.iconUrl,
      isMonitoringEnabled: connection.isMonitoringEnabled,
    },
  };
});
