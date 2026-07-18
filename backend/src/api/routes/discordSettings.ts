import Router from '@koa/router';
import { Types } from 'mongoose';
import { reloadDiscordFromDatabase } from '../../bot/client';
import { GuildConnectionModel } from '../../db/models/GuildConnection';
import { resolveDiscordBotConnected } from '../../services/discordClusterProxy';
import type { AuthUserPayload } from '../../services/authService';
import {
  buildDiscordBotInstallUrl,
  getOrganizationDiscordApplication,
  getPublicDiscordClientId,
  upsertOrganizationDiscordApplication,
} from '../../services/discordApplicationService';
import {
  getInstalledGuildSummary,
  listInstalledGuildSummaries,
  resolveInstalledGuildCount,
} from '../../services/discordInstalledGuildsService';
import { guildService } from '../../services/guildService';

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

  const botConnected = await resolveDiscordBotConnected();
  const guildCount = botConnected ? await resolveInstalledGuildCount() : 0;

  ctx.body = {
    botConnected,
    guildCount,
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

  if (!(await resolveDiscordBotConnected())) {
    ctx.status = 503;
    ctx.body = {
      error: 'Bot Discord não conectado',
      message: 'Cadastre o bot em Configurações → Discord antes de listar servidores',
    };
    return;
  }

  const activeConnections = await GuildConnectionModel.find({
    isActive: true,
    isMonitoringEnabled: true,
  })
    .select('organizationId guildId')
    .lean()
    .exec();

  const blockedGuildIds = new Set(
    activeConnections
      .filter((connection) => String(connection.organizationId) !== organizationId)
      .map((connection) => connection.guildId),
  );

  let guilds;
  try {
    guilds = (await listInstalledGuildSummaries()).filter(
      (guild) => !blockedGuildIds.has(guild.guildId),
    );
  } catch (error) {
    ctx.status = 503;
    ctx.body = {
      error: 'Bot Discord não conectado',
      message: (error as Error).message,
    };
    return;
  }

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

  if (!(await resolveDiscordBotConnected())) {
    ctx.status = 503;
    ctx.body = { error: 'Bot Discord não conectado' };
    return;
  }

  let guild;
  try {
    guild = await getInstalledGuildSummary(guildId);
  } catch (error) {
    ctx.status = 503;
    ctx.body = { error: (error as Error).message };
    return;
  }

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
      guildName: guild.guildName,
      iconUrl: guild.iconUrl,
      botInstalledAt: new Date(),
      isActive: true,
      isMonitoringEnabled: true,
      selectedAt: new Date(),
      selectedBy: user?.id && Types.ObjectId.isValid(user.id) ? new Types.ObjectId(user.id) : undefined,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).exec();

  try {
    await guildService.setSelectedGuildId(guildId);
  } catch {
    // Bot legado pode não estar conectado; GuildConnection já habilita monitoramento multitenant.
  }

  ctx.body = {
    connection: {
      guildId: connection.guildId,
      guildName: connection.guildName,
      iconUrl: connection.iconUrl,
      isMonitoringEnabled: connection.isMonitoringEnabled,
    },
  };
});

/**
 * @openapi
 * /org/{orgId}/discord/application:
 *   get:
 *     tags:
 *       - Discord
 *     summary: Retorna bot Discord cadastrado pela organização
 */
discordSettingsRouter.get('/discord/application', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente' };
    return;
  }

  const application = await getOrganizationDiscordApplication(organizationId);
  ctx.body = { application };
});

/**
 * @openapi
 * /org/{orgId}/discord/application:
 *   post:
 *     tags:
 *       - Discord
 *     summary: Cadastra ou atualiza bot Discord da organização
 */
discordSettingsRouter.post('/discord/application', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  const user = ctx.state.user as AuthUserPayload | undefined;
  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente' };
    return;
  }

  assertAdminRole(ctx, organizationId);

  const payload = ctx.request.body as {
    name?: string;
    clientId?: string;
    clientSecret?: string;
    botToken?: string;
  };

  if (!payload?.name?.trim() || !payload.clientId?.trim() || !payload.clientSecret?.trim() || !payload.botToken?.trim()) {
    ctx.status = 400;
    ctx.body = { error: 'Informe name, clientId, clientSecret e botToken' };
    return;
  }

  try {
    const application = await upsertOrganizationDiscordApplication(
      organizationId,
      {
        name: payload.name,
        clientId: payload.clientId,
        clientSecret: payload.clientSecret,
        botToken: payload.botToken,
      },
      user?.id ?? organizationId,
    );

    await reloadDiscordFromDatabase();

    ctx.status = 201;
    ctx.body = { application, message: 'Bot cadastrado e conectado com sucesso.' };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/discord/install-url:
 *   get:
 *     tags:
 *       - Discord
 *     summary: URL para adicionar o bot ao servidor Discord
 */
discordSettingsRouter.get('/discord/install-url', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente' };
    return;
  }

  const orgApp = await getOrganizationDiscordApplication(organizationId);
  const clientId = orgApp?.clientId ?? (await getPublicDiscordClientId());
  if (!clientId) {
    ctx.status = 400;
    ctx.body = { error: 'Cadastre o bot antes de gerar o link de instalação.' };
    return;
  }

  ctx.body = {
    installUrl: buildDiscordBotInstallUrl(clientId, organizationId),
    clientId,
  };
});
