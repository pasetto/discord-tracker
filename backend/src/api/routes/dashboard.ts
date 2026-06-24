import Router from '@koa/router';
import { getGuildLiveDashboard } from '../../services/dashboardLiveService';
import { assertGuildMonitoredByOrganization } from '../../services/guildAccessService';

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
    await assertGuildMonitoredByOrganization(organizationId, guildId);
    const snapshot = await getGuildLiveDashboard(guildId, organizationId);
    ctx.body = snapshot;
  } catch (error) {
    const message = (error as Error).message;
    ctx.status = message.includes('não monitorado') ? 403 : 503;
    ctx.body = { error: message };
  }
});
