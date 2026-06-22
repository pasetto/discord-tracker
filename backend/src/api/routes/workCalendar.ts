import Router from '@koa/router';
import type { WorkCalendarHoliday, WorkWeek } from '../../db/models/WorkCalendar';
import {
  getOrCreateOrganizationWorkCalendar,
  seedBrazilNationalHolidays,
  upsertOrganizationWorkCalendar,
} from '../../services/workCalendarService';

/**
 * Estrutura permitida no body de atualização do calendário.
 */
interface WorkCalendarPayload {
  workWeek?: WorkWeek;
  holidays?: WorkCalendarHoliday[];
}

/**
 * Retorna os identificadores obrigatórios de organização e usuário autenticado.
 * @param ctx Contexto da requisição Koa
 * @returns IDs normalizados para uso nos services
 * @throws {Error} Quando o contexto não contém dados de autenticação necessários
 */
function getRequestIdentity(ctx: Router.RouterContext): { organizationId: string; userId: string } {
  const organizationId = ctx.state.organizationId as string | undefined;
  const userId = (ctx.state.user as { id?: string } | undefined)?.id;

  if (!organizationId) {
    throw new Error('organizationId ausente no contexto autenticado');
  }

  if (!userId) {
    throw new Error('Usuário autenticado ausente no contexto');
  }

  return { organizationId, userId };
}

/** Rotas de calendário de trabalho por organização (tenant). */
export const workCalendarRouter = new Router();

/**
 * @openapi
 * /org/{orgId}/work-calendar:
 *   get:
 *     tags:
 *       - WorkCalendar
 *     summary: Busca o calendário de trabalho padrão da organização
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Calendário encontrado ou criado com padrão inicial
 */
workCalendarRouter.get('/work-calendar', async (ctx) => {
  try {
    const { organizationId, userId } = getRequestIdentity(ctx);
    const calendar = await getOrCreateOrganizationWorkCalendar(organizationId, userId);
    ctx.body = { calendar };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/work-calendar:
 *   put:
 *     tags:
 *       - WorkCalendar
 *     summary: Atualiza jornada semanal e feriados da organização
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Calendário atualizado com sucesso
 *       400:
 *         description: Payload inválido
 */
workCalendarRouter.put('/work-calendar', async (ctx) => {
  try {
    const payload = (ctx.request.body ?? {}) as WorkCalendarPayload;
    if (payload.workWeek === undefined && payload.holidays === undefined) {
      ctx.status = 400;
      ctx.body = { error: 'Payload inválido. Envie workWeek e/ou holidays.' };
      return;
    }

    const { organizationId, userId } = getRequestIdentity(ctx);
    const calendar = await upsertOrganizationWorkCalendar(organizationId, userId, payload);
    ctx.body = { calendar };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/work-calendar/seed-brazil-holidays:
 *   post:
 *     tags:
 *       - WorkCalendar
 *     summary: Aplica seed de feriados nacionais brasileiros de 2026-2028
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Seed aplicado com sucesso
 */
workCalendarRouter.post('/work-calendar/seed-brazil-holidays', async (ctx) => {
  try {
    const { organizationId, userId } = getRequestIdentity(ctx);
    const result = await seedBrazilNationalHolidays(organizationId, userId);
    ctx.body = {
      calendar: result.calendar,
      insertedCount: result.insertedCount,
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});
