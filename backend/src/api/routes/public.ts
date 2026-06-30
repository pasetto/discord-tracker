import Router from '@koa/router';
import { config } from '../../config/env';
import { listPublicPlans } from '../../services/billingService';
import { getPublicDiscordClientId } from '../../services/discordApplicationService';
import { previewOrganizationInvite } from '../../services/organizationTeamService';
import { API_BUILD_INFO, API_BUILD_VERSION, API_VERSION } from '../../version/appVersion';

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
    apiVersion: API_VERSION,
    apiBuildVersion: API_BUILD_VERSION,
    apiBuildGitSha: API_BUILD_INFO.gitSha,
    apiBuiltAt: API_BUILD_INFO.builtAt,
    apiBaseUrl: config.apiPublicUrl,
    discordClientId,
    pricingEnabled: true,
    botConfigured: Boolean(discordClientId),
    authMode: 'email_password',
  };
});

/**
 * @openapi
 * /public/invite-codes/{inviteCode}:
 *   get:
 *     tags:
 *       - Public
 *     summary: Valida código de convite e retorna nome da organização
 */
/**
 * @openapi
 * /pricing:
 *   get:
 *     tags:
 *       - Public
 *     summary: Lista planos públicos ativos para landing e checkout
 */
publicRouter.get('/pricing', async (ctx) => {
  const plans = await listPublicPlans();
  ctx.body = { plans };
});

publicRouter.get('/public/invite-codes/:inviteCode', async (ctx) => {
  try {
    const preview = await previewOrganizationInvite(ctx.params.inviteCode);
    ctx.body = preview;
  } catch (error) {
    ctx.status = 404;
    ctx.body = { error: (error as Error).message };
  }
});
