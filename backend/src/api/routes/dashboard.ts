import Router from '@koa/router';
import { getGuildLiveDashboard } from '../../services/dashboardLiveService';

/** Rotas de dashboard por organização e guild. */
export const dashboardRouter = new Router();

/**
 * GET /guilds/:guildId/dashboard/live - Snapshot de membros ativos e ranking online.
 */
dashboardRouter.get('/guilds/:guildId/dashboard/live', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  const guildId = ctx.params.guildId;

  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente no contexto autenticado' };
    return;
  }

  try {
    const snapshot = await getGuildLiveDashboard(guildId, organizationId);
    ctx.body = snapshot;
  } catch (error) {
    ctx.status = 503;
    ctx.body = { error: (error as Error).message };
  }
});
