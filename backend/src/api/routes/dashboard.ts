import Router from '@koa/router';
import { getGuildLiveDashboard } from '../../services/dashboardLiveService';
import { getGuildDashboardOverview } from '../../services/dashboardOverviewService';
import { assertGuildMonitoredByOrganization } from '../../services/guildAccessService';
import { assertViewerReadRole } from '../middleware/tenantRbac';

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
    ctx.set('Cache-Control', 'no-store');
    ctx.body = snapshot;
  } catch (error) {
    const message = (error as Error).message;
    ctx.status = message.includes('não monitorado') ? 403 : 503;
    ctx.body = { error: message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/dashboard/overview:
 *   get:
 *     tags:
 *       - Dashboard
 *     summary: Overview histórico de colaboração do time (7 dias + heatmap)
 *     description: |
 *       Agrega DailyReport dos membros rastreados por dia civil, com fallback de VoiceSession
 *       quando o relatório diário ainda não foi materializado. O heatmap usa transições
 *       colaborativas de voz dos últimos 7 dias agrupadas por dia da semana e hora comercial.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Série diária, média semanal e heatmap horário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 overview:
 *                   type: object
 *                   properties:
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                     timezone:
 *                       type: string
 *                     periodStart:
 *                       type: string
 *                     periodEnd:
 *                       type: string
 *                     trackedMembersCount:
 *                       type: integer
 *                     weeklyAverageHours:
 *                       type: number
 *                     dailyCollaboration:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                           collaborationHours:
 *                             type: number
 *                           voiceHours:
 *                             type: number
 *                     heatmap:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           dayIndex:
 *                             type: integer
 *                           hour:
 *                             type: integer
 *                           eventCount:
 *                             type: integer
 */
dashboardRouter.get('/guilds/:guildId/dashboard/overview', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  const guildId = ctx.params.guildId;

  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente no contexto autenticado' };
    return;
  }

  try {
    assertViewerReadRole(ctx, organizationId);
    await assertGuildMonitoredByOrganization(organizationId, guildId);
    const overview = await getGuildDashboardOverview(organizationId, guildId);
    ctx.set('Cache-Control', 'private, max-age=60');
    ctx.body = { overview };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});
