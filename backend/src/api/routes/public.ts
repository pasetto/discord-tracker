import Router from '@koa/router';
import { config } from '../../config/env';

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
publicRouter.get('/public/config', (ctx) => {
  ctx.body = {
    appName: 'Syntra',
    discordClientId: config.discordOauthClientId,
    pricingEnabled: true,
  };
});
