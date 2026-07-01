import http from 'http';
import Koa from 'koa';
import Router from '@koa/router';
import { checkDiscordHealth, discordClient } from '../bot/client';
import { config } from '../config/env';
import { createLogger } from '../logger';
import { internalAuthMiddleware } from './middleware/internalAuth';
import { buildGuildLiveDashboardOnBotInstance } from '../services/dashboardLiveService';
import { listGuildDiscordChannelsOnBotInstance } from '../services/discordGuildChannelService';
import { listHumanGuildMembersOnBotInstance } from '../services/trackedUserService';
import { getInternalDiscordPort } from '../services/discordClusterProxy';

const log = createLogger('internal-discord');

/**
 * Cria app Koa com rotas internas Discord (somente instância bot).
 * @returns Aplicação Koa configurada
 */
function createInternalDiscordApp(): Koa {
  const app = new Koa();
  const router = new Router();

  router.get('/internal/discord/health', (ctx) => {
    ctx.body = {
      discordConnected: checkDiscordHealth(),
      guildCount: discordClient.isReady() ? discordClient.guilds.cache.size : 0,
      runsBackgroundJobs: true,
    };
  });

  router.get('/internal/discord/guilds/:guildId/channels', async (ctx) => {
    const guildId = ctx.params.guildId;
    try {
      const channels = await listGuildDiscordChannelsOnBotInstance(guildId);
      ctx.body = { channels };
    } catch (error) {
      ctx.status = 503;
      ctx.body = { error: (error as Error).message };
    }
  });

  router.get('/internal/discord/guilds/:guildId/human-members', async (ctx) => {
    const guildId = ctx.params.guildId;
    try {
      const members = await listHumanGuildMembersOnBotInstance(guildId);
      ctx.body = { members };
    } catch (error) {
      ctx.status = 503;
      ctx.body = { error: (error as Error).message };
    }
  });

  router.get('/internal/discord/guilds/:guildId/live-dashboard', async (ctx) => {
    const guildId = ctx.params.guildId;
    const organizationId = typeof ctx.query.organizationId === 'string' ? ctx.query.organizationId : undefined;

    try {
      const snapshot = await buildGuildLiveDashboardOnBotInstance(guildId, organizationId);
      ctx.body = snapshot;
    } catch (error) {
      ctx.status = 503;
      ctx.body = { error: (error as Error).message };
    }
  });

  app.use(internalAuthMiddleware);
  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}

/**
 * Inicia servidor HTTP interno exclusivo da instância bot (PM2 instância 0).
 * Workers API-only encaminham operações Discord para esta porta em localhost.
 * @returns Função para encerrar o servidor no shutdown
 */
export function startInternalDiscordServer(): () => void {
  const app = createInternalDiscordApp();
  const port = getInternalDiscordPort();
  const server = http.createServer(app.callback());

  server.listen(port, '127.0.0.1', () => {
    log.info({ port }, 'Servidor interno Discord escutando (instância bot)');
  });

  server.on('error', (error) => {
    log.error({ err: error, port }, 'Falha ao iniciar servidor interno Discord');
  });

  return () => {
    server.close();
  };
}
