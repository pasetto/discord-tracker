import Router from '@koa/router';
import { Types } from 'mongoose';
import { getGoalsWeeklyReport, type GoalWeeklyReportEntry } from '../../services/goalsService';
import { getWeeklyInactivityReport } from '../../services/inactivityService';
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

/**
 * Campos aceitos para serialização em CSV.
 */
type CsvPrimitive = string | number | boolean | null | undefined;

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager']);

/**
 * Rotas de exportação CSV para inatividade e resumo de colaboração.
 */
export const exportRouter = new Router();

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
 * Garante que usuário possui permissão de gestão para exportações.
 * @param ctx Contexto Koa da requisição
 * @param organizationId Organização do tenant atual
 * @returns {void} Não retorna valor
 */
function assertManagerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !MANAGER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para exportar relatórios');
  }
}

/**
 * Escapa um valor para célula CSV seguindo RFC 4180.
 * @param value Valor primitivo da célula
 * @returns Texto pronto para o arquivo CSV
 */
function escapeCsvCell(value: CsvPrimitive): string {
  if (value === null || value === undefined) {
    return '';
  }

  const normalized = String(value);
  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replace(/"/g, '""')}"`;
}

/**
 * Converte linhas em string CSV.
 * @param headers Cabeçalhos das colunas
 * @param rows Linhas no mesmo formato dos cabeçalhos
 * @returns CSV serializado em UTF-8
 */
function buildCsv(headers: string[], rows: CsvPrimitive[][]): string {
  const serializedHeaders = headers.map((header) => escapeCsvCell(header)).join(',');
  const serializedRows = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(','));
  return [serializedHeaders, ...serializedRows].join('\n');
}

/**
 * Formata data para string ISO no CSV.
 * @param value Data opcional
 * @returns Data serializada no padrão ISO ou vazio
 */
function formatDate(value?: Date | null): string {
  return value ? value.toISOString() : '';
}

/**
 * Converte entrada de meta semanal para linha de CSV.
 * @param entry Linha do relatório de metas
 * @returns Valores serializados para o CSV de colaboração
 */
function mapGoalEntryToCsvRow(entry: GoalWeeklyReportEntry): CsvPrimitive[] {
  return [
    entry.displayName,
    entry.discordId,
    entry.weeklyGoalHours ?? '',
    entry.periodMinimumHours ?? '',
    entry.businessDaysInPeriod,
    entry.realizedHours,
    entry.progressPercent,
    entry.dailyMinimumHours ?? '',
    entry.shouldAlertLowProgress,
  ];
}

/**
 * Define headers HTTP para download de arquivo CSV.
 * @param ctx Contexto Koa da requisição
 * @param fileName Nome do arquivo baixado
 * @returns {void} Não retorna valor
 */
function setCsvDownloadHeaders(ctx: Router.RouterContext, fileName: string): void {
  ctx.type = 'text/csv; charset=utf-8';
  ctx.set('Content-Disposition', `attachment; filename="${fileName}"`);
}

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/export/inactivity:
 *   post:
 *     tags:
 *       - Exports
 *     summary: Exporta CSV do relatório semanal de inatividade
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV para download
 *       400:
 *         description: Parâmetros inválidos
 *       403:
 *         description: Sem permissão de gestão
 */
exportRouter.post('/guilds/:guildId/export/inactivity', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);

    const categoryId = typeof ctx.query.categoryId === 'string' ? ctx.query.categoryId : undefined;
    if (categoryId && !Types.ObjectId.isValid(categoryId)) {
      ctx.status = 400;
      ctx.body = { error: 'categoryId inválido' };
      return;
    }

    const range = parseReportDateRangeQuery({
      preset: typeof ctx.query.preset === 'string' ? ctx.query.preset : undefined,
      from: typeof ctx.query.from === 'string' ? ctx.query.from : undefined,
      to: typeof ctx.query.to === 'string' ? ctx.query.to : undefined,
    });

    const report = await getWeeklyInactivityReport(
      organizationId,
      ctx.params.guildId,
      { categoryId, from: range.from, to: range.to },
      range.to,
    );
    const headers = [
      'displayName',
      'discordId',
      'categoryName',
      'status',
      'inactiveBusinessDays',
      'lastSeenAt',
      'lastTextActivityAt',
      'lastPresenceAt',
      'lastVoiceCollaborationAt',
    ];
    const rows = report.entries.map((entry) => [
      entry.displayName,
      entry.discordId,
      entry.categoryName ?? '',
      entry.status,
      entry.inactiveBusinessDays,
      formatDate(entry.lastSeenAt),
      formatDate(entry.lastTextActivityAt),
      formatDate(entry.lastPresenceAt),
      formatDate(entry.lastVoiceCollaborationAt),
    ]);

    setCsvDownloadHeaders(ctx, `inactivity-weekly-${report.periodEnd.toISOString().slice(0, 10)}.csv`);
    ctx.body = buildCsv(headers, rows);
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/guilds/{guildId}/export/csv:
 *   post:
 *     tags:
 *       - Exports
 *     summary: Exporta CSV do resumo semanal de colaboração
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV para download
 *       400:
 *         description: Parâmetros inválidos
 *       403:
 *         description: Sem permissão de gestão
 */
exportRouter.post('/guilds/:guildId/export/csv', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);

    const categoryId = typeof ctx.query.categoryId === 'string' ? ctx.query.categoryId : undefined;
    if (categoryId && !Types.ObjectId.isValid(categoryId)) {
      ctx.status = 400;
      ctx.body = { error: 'categoryId inválido' };
      return;
    }

    const range = parseReportDateRangeQuery({
      preset: typeof ctx.query.preset === 'string' ? ctx.query.preset : undefined,
      from: typeof ctx.query.from === 'string' ? ctx.query.from : undefined,
      to: typeof ctx.query.to === 'string' ? ctx.query.to : undefined,
    });

    const report = await getGoalsWeeklyReport({
      organizationId,
      guildId: ctx.params.guildId,
      categoryId,
      from: range.from,
      to: range.to,
      referenceDate: range.to,
    });

    const headers = [
      'displayName',
      'discordId',
      'weeklyGoalHours',
      'periodMinimumHours',
      'businessDaysInPeriod',
      'realizedHours',
      'progressPercent',
      'dailyMinimumHours',
      'shouldAlertLowProgress',
    ];
    const rows = report.entries.map((entry) => mapGoalEntryToCsvRow(entry));

    setCsvDownloadHeaders(ctx, `collaboration-summary-${report.periodEnd.toISOString().slice(0, 10)}.csv`);
    ctx.body = buildCsv(headers, rows);
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});
