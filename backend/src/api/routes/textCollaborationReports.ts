import Router from '@koa/router';
import { getTextCollaborationReport } from '../../services/textCollaborationReportService';
import { parseReportDateRangeQuery } from '../../utils/reportDateRange';

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

/** Rotas de relatório de sinais de texto colaborativo. */
export const textCollaborationReportsRouter = new Router();

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
 */
function assertViewerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !VIEWER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para visualizar relatório de sinais de texto');
  }
}

/**
 * Extrai organizationId do contexto autenticado.
 * @param ctx Contexto Koa da requisição
 * @returns organizationId resolvido pelo tenant middleware
 * @throws {Error} Quando contexto não possui organizationId
 */
function getRequestOrganizationId(ctx: Router.RouterContext): string {
  const organizationId = ctx.state.organizationId as string | undefined;
  if (!organizationId) {
    throw new Error('organizationId ausente no contexto autenticado');
  }
  return organizationId;
}

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/reports/text-collaboration:
 *   get:
 *     tags:
 *       - Reports
 *     summary: Retorna relatório de sinais de texto colaborativo por membro
 *     description: Agrega quantidade de eventos textuais e último sinal por discordId, sem expor conteúdo de mensagens.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: preset
 *         schema:
 *           type: string
 *           enum: [today, yesterday, this_week, last_week, last_7_days]
 *     responses:
 *       200:
 *         description: Relatório agregado de sinais de texto no período
 *       400:
 *         description: Parâmetros inválidos
 *       403:
 *         description: Permissão insuficiente
 */
textCollaborationReportsRouter.get('/guilds/:guildId/reports/text-collaboration', async (ctx) => {
  try {
    const organizationId = getRequestOrganizationId(ctx);
    assertViewerRole(ctx, organizationId);

    const fromParam = typeof ctx.query.from === 'string' ? ctx.query.from : undefined;
    const toParam = typeof ctx.query.to === 'string' ? ctx.query.to : undefined;
    const presetParam = typeof ctx.query.preset === 'string' ? ctx.query.preset : undefined;

    const range = fromParam || toParam || presetParam
      ? parseReportDateRangeQuery({ preset: presetParam, from: fromParam, to: toParam })
      : parseReportDateRangeQuery({ preset: 'last_7_days' });

    const report = await getTextCollaborationReport({
      organizationId,
      guildId: ctx.params.guildId,
      from: range.from,
      to: range.to,
    });
    ctx.body = { report };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});
