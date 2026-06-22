import Router from '@koa/router';
import { Types } from 'mongoose';
import {
  cancelPlannedAbsence,
  createPlannedAbsence,
  listActivePlannedAbsences,
  listPlannedAbsences,
  updatePlannedAbsence,
} from '../../services/plannedAbsenceService';
import { PlannedAbsenceStatus, PlannedAbsenceType } from '../../db/models/PlannedAbsence';

/**
 * Corpo permitido para criação de ausência.
 */
interface CreateAbsencePayload {
  trackedUserId?: string;
  discordId?: string;
  type?: PlannedAbsenceType;
  startDate?: string;
  endDate?: string;
  note?: string;
}

/**
 * Corpo permitido para atualização de ausência.
 */
interface UpdateAbsencePayload {
  discordId?: string;
  type?: PlannedAbsenceType;
  startDate?: string;
  endDate?: string;
  note?: string;
}

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

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager']);
const VIEWER_ROLES = new Set(['owner', 'admin', 'manager', 'viewer']);
const ALLOWED_TYPES = new Set<PlannedAbsenceType>(['vacation', 'pto', 'sick_leave', 'other']);
const ALLOWED_STATUS = new Set<PlannedAbsenceStatus>(['scheduled', 'active', 'completed', 'cancelled']);

/** Rotas CRUD de ausências planejadas por organização/guild. */
export const absencesRouter = new Router();

/**
 * Retorna identidade autenticada da requisição (org + user).
 * @param ctx Contexto Koa da requisição
 * @returns IDs autenticados para operações multitenant
 * @throws {Error} Quando contexto não possui org/user válidos
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
 * Garante que usuário possui pelo menos papel de visualização.
 * @param ctx Contexto Koa da requisição
 * @param organizationId Organização do tenant atual
 * @returns {void} Não retorna valor
 */
function assertViewerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !VIEWER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para visualizar ausências');
  }
}

/**
 * Garante que usuário possui papel de gestão para mutações.
 * @param ctx Contexto Koa da requisição
 * @param organizationId Organização do tenant atual
 * @returns {void} Não retorna valor
 */
function assertManagerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !MANAGER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para gerenciar ausências');
  }
}

/**
 * Converte string ISO em Date validando formato.
 * @param value Valor textual recebido no payload/query
 * @param field Nome do campo para mensagens de erro
 * @returns Data válida
 * @throws {Error} Quando data for inválida
 */
function parseDate(value: string | undefined, field: string): Date {
  if (!value) {
    throw new Error(`${field} é obrigatório`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} inválido`);
  }

  return parsed;
}

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/absences:
 *   get:
 *     tags:
 *       - Absences
 *     summary: Lista ausências planejadas por guild
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, active, completed, cancelled]
 *     responses:
 *       200:
 *         description: Lista de ausências
 */
absencesRouter.get('/guilds/:guildId/absences', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);

    const status = typeof ctx.query.status === 'string' ? (ctx.query.status as PlannedAbsenceStatus) : undefined;
    if (status && !ALLOWED_STATUS.has(status)) {
      ctx.status = 400;
      ctx.body = { error: 'status inválido' };
      return;
    }

    const from = typeof ctx.query.from === 'string' ? parseDate(ctx.query.from, 'from') : undefined;
    const to = typeof ctx.query.to === 'string' ? parseDate(ctx.query.to, 'to') : undefined;

    const absences = await listPlannedAbsences(organizationId, ctx.params.guildId, { from, to, status });
    ctx.body = { absences };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/absences/active:
 *   get:
 *     tags:
 *       - Absences
 *     summary: Lista ausências ativas no momento
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ausências ativas encontradas
 */
absencesRouter.get('/guilds/:guildId/absences/active', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertViewerRole(ctx, organizationId);

    const absences = await listActivePlannedAbsences(organizationId, ctx.params.guildId, new Date());
    ctx.body = { absences };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/absences:
 *   post:
 *     tags:
 *       - Absences
 *     summary: Cria uma ausência planejada para um membro
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Ausência criada
 *       400:
 *         description: Payload inválido
 */
absencesRouter.post('/guilds/:guildId/absences', async (ctx) => {
  try {
    const { organizationId, userId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);

    const payload = (ctx.request.body ?? {}) as CreateAbsencePayload;
    if (!payload.trackedUserId || !Types.ObjectId.isValid(payload.trackedUserId)) {
      ctx.status = 400;
      ctx.body = { error: 'trackedUserId inválido' };
      return;
    }
    if (!payload.discordId?.trim()) {
      ctx.status = 400;
      ctx.body = { error: 'discordId é obrigatório' };
      return;
    }
    if (!payload.type || !ALLOWED_TYPES.has(payload.type)) {
      ctx.status = 400;
      ctx.body = { error: 'type inválido' };
      return;
    }

    const absence = await createPlannedAbsence({
      organizationId,
      guildId: ctx.params.guildId,
      trackedUserId: payload.trackedUserId,
      discordId: payload.discordId.trim(),
      type: payload.type,
      startDate: parseDate(payload.startDate, 'startDate'),
      endDate: parseDate(payload.endDate, 'endDate'),
      note: payload.note,
      createdBy: userId,
    });

    ctx.status = 201;
    ctx.body = { absence };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/absences/{id}:
 *   put:
 *     tags:
 *       - Absences
 *     summary: Atualiza uma ausência planejada existente
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ausência atualizada
 *       404:
 *         description: Ausência não encontrada
 */
absencesRouter.put('/guilds/:guildId/absences/:id', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);

    if (!Types.ObjectId.isValid(ctx.params.id)) {
      ctx.status = 400;
      ctx.body = { error: 'id inválido' };
      return;
    }

    const payload = (ctx.request.body ?? {}) as UpdateAbsencePayload;
    if (payload.type && !ALLOWED_TYPES.has(payload.type)) {
      ctx.status = 400;
      ctx.body = { error: 'type inválido' };
      return;
    }

    const absence = await updatePlannedAbsence(organizationId, ctx.params.guildId, ctx.params.id, {
      discordId: payload.discordId?.trim() || undefined,
      type: payload.type,
      startDate: payload.startDate ? parseDate(payload.startDate, 'startDate') : undefined,
      endDate: payload.endDate ? parseDate(payload.endDate, 'endDate') : undefined,
      note: payload.note,
    });

    if (!absence) {
      ctx.status = 404;
      ctx.body = { error: 'Ausência não encontrada' };
      return;
    }

    ctx.body = { absence };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/absences/{id}:
 *   delete:
 *     tags:
 *       - Absences
 *     summary: Cancela uma ausência planejada
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Ausência cancelada
 *       404:
 *         description: Ausência não encontrada
 */
absencesRouter.delete('/guilds/:guildId/absences/:id', async (ctx) => {
  try {
    const { organizationId, userId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);

    if (!Types.ObjectId.isValid(ctx.params.id)) {
      ctx.status = 400;
      ctx.body = { error: 'id inválido' };
      return;
    }

    const cancelled = await cancelPlannedAbsence(organizationId, ctx.params.guildId, ctx.params.id, userId);
    if (!cancelled) {
      ctx.status = 404;
      ctx.body = { error: 'Ausência não encontrada' };
      return;
    }

    ctx.status = 204;
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});
