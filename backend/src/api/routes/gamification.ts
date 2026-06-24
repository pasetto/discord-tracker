import Router from '@koa/router';
import { Types } from 'mongoose';
import {
  PlanFeatureNotAvailableError,
  getGamificationSettings,
  upsertGamificationSettings,
} from '../../services/gamificationService';
import { getGamificationRankingReport } from '../../services/gamificationRankingService';
import { getGuildGamificationInsights } from '../../services/gamificationInsightsService';

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

/**
 * Payload parcial aceito para atualização de gamificação.
 */
interface GamificationPatchPayload {
  enabled?: boolean;
  ranking?: {
    enabled?: boolean;
  };
  badges?: {
    enabled?: boolean;
  };
  streaks?: {
    enabled?: boolean;
  };
  teamGoals?: {
    enabled?: boolean;
  };
}

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager']);
const VIEWER_ROLES = new Set(['owner', 'admin', 'manager', 'viewer']);

/** Rotas de configuração de gamificação por guild. */
export const gamificationRouter = new Router();

/**
 * Obtém role do usuário autenticado para a organização atual.
 * @param {Router.RouterContext} ctx Contexto Koa da requisição
 * @param {string} organizationId Organização do tenant atual
 * @returns {string | undefined} Papel normalizado em minúsculas
 */
function getMembershipRole(ctx: Router.RouterContext, organizationId: string): string | undefined {
  const user = ctx.state.user as JwtUserShape | undefined;
  const membership = user?.memberships?.find((item) => item.organizationId === organizationId);
  return membership?.role?.toLowerCase();
}

/**
 * Garante permissão de gestão para leitura/escrita da gamificação.
 * @param {Router.RouterContext} ctx Contexto Koa da requisição
 * @param {string} organizationId Organização do tenant atual
 * @returns {void} Não retorna valor
 */
function assertManagerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !MANAGER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para gerenciar gamificação');
  }
}

/**
 * Garante permissão mínima de visualização do ranking gamificado.
 * @param ctx Contexto Koa da requisição
 * @param organizationId Organização do tenant atual
 */
function assertViewerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !VIEWER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para visualizar ranking');
  }
}

/**
 * Extrai dados de identificação da requisição autenticada.
 * @param {Router.RouterContext} ctx Contexto Koa da requisição
 * @returns {{ organizationId: string; userId: string }} IDs de organização e usuário
 * @throws {Error} Quando contexto não possui tenant/usuário válidos
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
 * Mapeia erros de regra para status HTTP.
 * @param {unknown} error Exceção capturada
 * @returns {number} Código HTTP apropriado
 */
function mapHttpStatus(error: unknown): number {
  if (error instanceof PlanFeatureNotAvailableError) {
    return 403;
  }
  if (typeof (error as { status?: unknown })?.status === 'number') {
    return (error as { status: number }).status;
  }
  return 400;
}

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/gamification:
 *   get:
 *     tags:
 *       - Gamification
 *     summary: Retorna configuração de gamificação da guild
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuração atual de gamificação e flags do plano
 */
gamificationRouter.get('/guilds/:guildId/gamification', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);

    const result = await getGamificationSettings({
      organizationId,
      guildId: ctx.params.guildId,
    });

    ctx.body = result;
  } catch (error) {
    ctx.status = mapHttpStatus(error);
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/gamification:
 *   put:
 *     tags:
 *       - Gamification
 *     summary: Cria ou atualiza configuração de gamificação da guild
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuração atualizada com sucesso
 */
gamificationRouter.put('/guilds/:guildId/gamification', async (ctx) => {
  try {
    const { organizationId, userId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);

    const payload = (ctx.request.body ?? {}) as GamificationPatchPayload;
    const result = await upsertGamificationSettings({
      organizationId,
      guildId: ctx.params.guildId,
      updatedBy: userId,
      patch: payload,
    });

    ctx.body = result;
  } catch (error) {
    ctx.status = mapHttpStatus(error);
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/gamification/ranking:
 *   get:
 *     tags:
 *       - Gamification
 *     summary: Ranking gamificado conforme configuração da guild
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ranking do período configurado
 */
gamificationRouter.get('/guilds/:guildId/gamification/ranking', async (ctx) => {
  try {
    const { organizationId, userId } = getRequestIdentity(ctx);
    assertViewerRole(ctx, organizationId);

    const referenceDate =
      typeof ctx.query.referenceDate === 'string' ? new Date(ctx.query.referenceDate) : new Date();
    if (Number.isNaN(referenceDate.getTime())) {
      ctx.status = 400;
      ctx.body = { error: 'referenceDate inválida' };
      return;
    }

    const report = await getGamificationRankingReport({
      organizationId,
      guildId: ctx.params.guildId,
      viewerPlatformUserId: userId,
      viewerRole: getMembershipRole(ctx, organizationId),
      referenceDate,
    });

    ctx.body = { report };
  } catch (error) {
    ctx.status = mapHttpStatus(error);
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/gamification/insights:
 *   get:
 *     tags:
 *       - Gamification
 *     summary: Conquistas (badges e streaks) dos membros rastreados
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Badges e streaks por colaborador
 */
gamificationRouter.get('/guilds/:guildId/gamification/insights', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertViewerRole(ctx, organizationId);

    const referenceDate =
      typeof ctx.query.referenceDate === 'string' ? new Date(ctx.query.referenceDate) : new Date();
    if (Number.isNaN(referenceDate.getTime())) {
      ctx.status = 400;
      ctx.body = { error: 'referenceDate inválida' };
      return;
    }

    const insights = await getGuildGamificationInsights({
      organizationId,
      guildId: ctx.params.guildId,
      referenceDate,
    });

    ctx.body = { insights };
  } catch (error) {
    ctx.status = mapHttpStatus(error);
    ctx.body = { error: (error as Error).message };
  }
});
