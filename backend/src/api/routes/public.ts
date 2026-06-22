import Router from '@koa/router';
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
 *     responses:
 *       200:
 *         description: Configuração pública carregada com sucesso
 */
publicRouter.get('/public/config', async (ctx) => {
  const discordClientId = await getPublicDiscordClientId();

  ctx.body = {
    appName: 'Syntra',
    discordClientId,
    discordAuthPath: '/api/v1/auth/discord',
    pricingEnabled: true,
    botConfigured: Boolean(discordClientId),
  };
});
