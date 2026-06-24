import Router from '@koa/router';
import { Types } from 'mongoose';
import { getWeeklyInactivityReport, getInactivityHistory } from '../../services/inactivityService';
import { getIntradayInactivityReport } from '../../services/intradayInactivityService';
import { getInactivitySettings, upsertInactivitySettings } from '../../services/inactivitySettingsService';

/**
 * Membership de organização presente no JWT.
 */
interface JwtMembership {
  organizationId: string;
  role: string;
}

/**
 * Shape mínimo do usuário autenticado em `ctx.state.user`.
 */
interface JwtUserShape {
  id?: string;
  memberships?: JwtMembership[];
}

const VIEWER_ROLES = new Set(['owner', 'admin', 'manager', 'viewer']);
const MANAGER_ROLES = new Set(['owner', 'admin', 'manager']);

/** Rotas de relatório core de inatividade ("quem sumiu"). */
export const inactivityRouter = new Router();

/**
 * Retorna identidade autenticada da requisição.
 * @param ctx Contexto Koa da requisição
 * @returns IDs de organização e usuário autenticado
 * @throws {Error} Quando contexto não possui identidade válida
 */
function getRequestIdentity(ctx: Router.RouterContext): { organizationId: string; userId: string } {
  const organizationId = ctx.state.organizationId as string | undefined;
  const userId = (ctx.state.user as JwtUserShape | undefined)?.id;

  if (!organizationId) {
    throw new Error('organizationId ausente no contexto autenticado');
  }
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new Error('Usuário autenticado inválido');
  }

  return { organizationId, userId };
}

/**
 * Obtém role do usuário autenticado para a organização atual.
 * @param ctx Contexto Koa da requisição
 * @param organizationId Organização do tenant atual
 * @returns Papel normalizado em minúsculas
 */
function getMembershipRole(ctx: Router.RouterContext, organizationId: string): string | undefined {
  const user = ctx.state.user as JwtUserShape | undefined;
  const membership = user?.memberships?.find((item) => item.organizationId === organizationId);
  return membership?.role?.toLowerCase();
}

/**
 * Garante que usuário possui ao menos permissão de visualização.
 * @param ctx Contexto Koa da requisição
 * @param organizationId Organização do tenant atual
 * @returns {void} Não retorna valor
 */
function assertViewerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !VIEWER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para visualizar relatório de inatividade');
  }
}

/**
 * Garante que usuário possui papel de gestão para alterar configurações.
 * @param ctx Contexto Koa da requisição
 * @param organizationId Organização do tenant atual
 * @returns {void} Não retorna valor
 */
function assertManagerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !MANAGER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para alterar configurações de inatividade');
  }
}

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/reports/inactivity/weekly:
 *   get:
 *     tags:
 *       - Inactivity
 *     summary: Lista semanal de "quem sumiu" por guild
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Relatório semanal calculado para o gestor
 *       400:
 *         description: Parâmetros inválidos
 */
inactivityRouter.get('/guilds/:guildId/reports/inactivity/weekly', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertViewerRole(ctx, organizationId);

    const categoryId = typeof ctx.query.categoryId === 'string' ? ctx.query.categoryId : undefined;
    if (categoryId && !Types.ObjectId.isValid(categoryId)) {
      ctx.status = 400;
      ctx.body = { error: 'categoryId inválido' };
      return;
    }

    const report = await getWeeklyInactivityReport(organizationId, ctx.params.guildId, { categoryId }, new Date());
    ctx.body = { report };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/reports/inactivity/intraday:
 *   get:
 *     tags:
 *       - Inactivity
 *     summary: Alerta intradiário de quem sumiu hoje
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Relatório intradiário com colaboradores em alerta
 */
inactivityRouter.get('/guilds/:guildId/reports/inactivity/intraday', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertViewerRole(ctx, organizationId);

    const report = await getIntradayInactivityReport(organizationId, ctx.params.guildId, new Date());
    ctx.body = { report };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/inactivity-settings:
 *   get:
 *     tags:
 *       - Inactivity
 *     summary: Obtém configurações de inatividade da guild
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações efetivas (com defaults quando ausentes)
 */
inactivityRouter.get('/guilds/:guildId/inactivity-settings', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertViewerRole(ctx, organizationId);

    const settings = await getInactivitySettings(organizationId, ctx.params.guildId);
    ctx.body = { settings };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/inactivity-settings:
 *   put:
 *     tags:
 *       - Inactivity
 *     summary: Atualiza configurações de inatividade da guild
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configurações persistidas
 */
inactivityRouter.put('/guilds/:guildId/inactivity-settings', async (ctx) => {
  try {
    const { organizationId, userId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);

    const body = ctx.request.body as Record<string, unknown>;
    const settings = await upsertInactivitySettings(organizationId, ctx.params.guildId, userId, {
      inactiveAfterBusinessDays: typeof body.inactiveAfterBusinessDays === 'number' ? body.inactiveAfterBusinessDays : undefined,
      zeroVoiceCollaborationDays: typeof body.zeroVoiceCollaborationDays === 'number' ? body.zeroVoiceCollaborationDays : undefined,
      lateStartThresholdPercent: typeof body.lateStartThresholdPercent === 'number' ? body.lateStartThresholdPercent : undefined,
      minCollaborationPercentOfElapsed: typeof body.minCollaborationPercentOfElapsed === 'number' ? body.minCollaborationPercentOfElapsed : undefined,
      notifyManagerPush: typeof body.notifyManagerPush === 'boolean' ? body.notifyManagerPush : undefined,
      notifyManagerEmail: typeof body.notifyManagerEmail === 'boolean' ? body.notifyManagerEmail : undefined,
    });
    ctx.body = { settings };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/reports/inactivity/history:
 *   get:
 *     tags:
 *       - Inactivity
 *     summary: Histórico semanal de inatividade por membro rastreado
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: trackedUserId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Timeline de status por semana
 */
inactivityRouter.get('/guilds/:guildId/reports/inactivity/history', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertViewerRole(ctx, organizationId);

    const trackedUserId = typeof ctx.query.trackedUserId === 'string' ? ctx.query.trackedUserId : '';
    if (!trackedUserId || !Types.ObjectId.isValid(trackedUserId)) {
      ctx.status = 400;
      ctx.body = { error: 'trackedUserId inválido' };
      return;
    }

    const limitRaw = typeof ctx.query.limit === 'string' ? Number(ctx.query.limit) : 12;
    const limit = Number.isFinite(limitRaw) ? limitRaw : 12;

    const history = await getInactivityHistory(organizationId, ctx.params.guildId, trackedUserId, limit);
    ctx.body = { history };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});
