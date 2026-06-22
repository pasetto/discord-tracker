import Router from '@koa/router';
import { config } from '../../config/env';
import { DiscordApplicationModel } from '../../db/models/DiscordApplication';
import { PlatformUserModel } from '../../db/models/PlatformUser';
import {
  activateDiscordApplication,
  createDiscordApplication,
  listDiscordApplications,
  validateDiscordApplication,
} from '../../services/discordApplicationService';
import { hashPassword } from '../../services/platformAuthService';
import { reloadDiscordFromDatabase } from '../../bot/client';
import { getPlatformUserId } from '../middleware/superAdmin';

/** Rotas administrativas de aplicativos Discord da plataforma. */
export const adminDiscordRouter = new Router({ prefix: '/admin' });

/**
 * Bootstrap inicial (somente dev, sem apps cadastrados).
 * Permite cadastrar o primeiro bot sem super admin pré-existente.
 */
export const adminDiscordBootstrapRouter = new Router();

adminDiscordBootstrapRouter.post('/admin/discord-applications/bootstrap', async (ctx) => {
  if (config.nodeEnv === 'production') {
    ctx.status = 404;
    return;
  }

  const existingCount = await DiscordApplicationModel.countDocuments();
  if (existingCount > 0) {
    ctx.status = 403;
    ctx.body = { error: 'Bootstrap já utilizado. Use /api/v1/admin/discord-applications com JWT de super admin.' };
    return;
  }

  const payload = ctx.request.body as {
    name?: string;
    clientId?: string;
    clientSecret?: string;
    botToken?: string;
    superAdminDiscordId?: string;
  };

  if (!payload?.name?.trim() || !payload.clientId?.trim() || !payload.clientSecret?.trim() || !payload.botToken?.trim()) {
    ctx.status = 400;
    ctx.body = { error: 'Informe name, clientId, clientSecret e botToken' };
    return;
  }

  const bootstrapPasswordHash = await hashPassword('bootstrap-syntra-dev');

  const bootstrapUser = await PlatformUserModel.findOneAndUpdate(
    { email: 'bootstrap@syntra.local' },
    {
      email: 'bootstrap@syntra.local',
      passwordHash: bootstrapPasswordHash,
      displayName: 'Bootstrap Syntra',
      isSuperAdmin: true,
      memberships: [],
    },
    { upsert: true, new: true },
  ).exec();

  if (payload.superAdminDiscordId?.trim()) {
    await PlatformUserModel.findOneAndUpdate(
      { discordId: payload.superAdminDiscordId.trim() },
      {
        email: `discord-${payload.superAdminDiscordId.trim()}@syntra.local`,
        passwordHash: bootstrapPasswordHash,
        discordId: payload.superAdminDiscordId.trim(),
        displayName: 'Super Admin',
        isSuperAdmin: true,
        memberships: [],
      },
      { upsert: true, new: true },
    ).exec();
  }

  try {
    const application = await createDiscordApplication(
      {
        name: payload.name,
        clientId: payload.clientId,
        clientSecret: payload.clientSecret,
        botToken: payload.botToken,
        isPlatformDefault: true,
      },
      String(bootstrapUser._id),
    );

    await reloadDiscordFromDatabase();

    ctx.status = 201;
    ctx.body = {
      application,
      message: 'Bot cadastrado. Remova DISCORD_TOKEN do .env se ainda existir.',
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /admin/discord-applications:
 *   get:
 *     tags:
 *       - Admin
 *     summary: Lista aplicativos Discord cadastrados (mascarados)
 *     security:
 *       - bearerAuth: []
 */
adminDiscordRouter.get('/discord-applications', async (ctx) => {
  ctx.body = {
    applications: await listDiscordApplications(),
  };
});

/**
 * @openapi
 * /admin/discord-applications:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Cadastra aplicativo Discord da plataforma
 *     security:
 *       - bearerAuth: []
 */
adminDiscordRouter.post('/discord-applications', async (ctx) => {
  const payload = ctx.request.body as {
    name?: string;
    clientId?: string;
    clientSecret?: string;
    botToken?: string;
    isPlatformDefault?: boolean;
  };

  if (!payload?.name?.trim() || !payload.clientId?.trim() || !payload.clientSecret?.trim() || !payload.botToken?.trim()) {
    ctx.status = 400;
    ctx.body = { error: 'Informe name, clientId, clientSecret e botToken' };
    return;
  }

  try {
    const application = await createDiscordApplication(
      {
        name: payload.name,
        clientId: payload.clientId,
        clientSecret: payload.clientSecret,
        botToken: payload.botToken,
        isPlatformDefault: payload.isPlatformDefault,
      },
      getPlatformUserId(ctx),
    );

    if (application.isPlatformDefault) {
      await reloadDiscordFromDatabase();
    }

    ctx.status = 201;
    ctx.body = { application };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /admin/discord-applications/{id}/validate:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Valida token do bot contra a API do Discord
 */
adminDiscordRouter.post('/discord-applications/:id/validate', async (ctx) => {
  try {
    ctx.body = {
      application: await validateDiscordApplication(ctx.params.id),
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /admin/discord-applications/{id}/activate:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Ativa aplicativo como padrão e reconecta o bot
 */
adminDiscordRouter.post('/discord-applications/:id/activate', async (ctx) => {
  try {
    const application = await activateDiscordApplication(ctx.params.id);
    await reloadDiscordFromDatabase();
    ctx.body = { application };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});
