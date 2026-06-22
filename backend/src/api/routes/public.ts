import Router from '@koa/router';
import { config } from '../../config/env';
import { getPublicDiscordClientId } from '../../services/discordApplicationService';

/** Rotas públicas sem autenticação para bootstrap do frontend. */
export const publicRouter = new Router();

/**
 * @openapi
 * /public/config:
 *   get:
 *     tags:
 *       - Public
 *     summary: Retorna configuração pública de bootstrap do frontend
 */
publicRouter.get('/public/config', async (ctx) => {
  const discordClientId = await getPublicDiscordClientId();

  ctx.body = {
    appName: 'Syntra',
    apiBaseUrl: config.apiPublicUrl,
    discordClientId,
    pricingEnabled: true,
    botConfigured: Boolean(discordClientId),
    authMode: 'email_password',
  };
});
