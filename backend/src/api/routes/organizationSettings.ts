import Router from '@koa/router';
import { Types } from 'mongoose';
import { OrganizationModel } from '../../db/models/Organization';
import { getMembershipRole } from '../middleware/tenantRbac';

/** Rotas de configurações globais da organização (tenant). */
export const organizationSettingsRouter = new Router();

/**
 * Garante que o usuário autenticado seja owner/admin da organização.
 * @param {Router.RouterContext} ctx Contexto Koa da requisição
 * @param {string} organizationId Identificador da organização
 * @returns {void} Não retorna valor
 * @throws {Error} Lança 403 quando o usuário não possui permissão administrativa
 */
function assertOwnerAdminRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (role !== 'owner' && role !== 'admin') {
    ctx.throw(403, 'Permissão insuficiente para alterar permissões da organização');
  }
}

/**
 * Resolve o `organizationId` do contexto com validação de ObjectId.
 * @param {Router.RouterContext} ctx Contexto Koa da requisição
 * @returns {string} Identificador textual da organização
 * @throws {Error} Lança erro quando o tenant não está disponível no contexto
 */
function getOrganizationId(ctx: Router.RouterContext): string {
  const organizationId = ctx.state.organizationId as string | undefined;
  if (!organizationId) {
    throw new Error('organizationId ausente no contexto autenticado');
  }

  if (!Types.ObjectId.isValid(organizationId)) {
    throw new Error('organizationId inválido');
  }

  return organizationId;
}

/**
 * @openapi
 * /org/{orgId}/settings/permissions:
 *   get:
 *     tags:
 *       - Organization
 *     summary: Retorna permissões globais de visibilidade da organização
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permissões atuais da organização
 */
organizationSettingsRouter.get('/settings/permissions', async (ctx) => {
  try {
    const organizationId = getOrganizationId(ctx);
    assertOwnerAdminRole(ctx, organizationId);

    const organization = await OrganizationModel.findById(organizationId)
      .select({ 'settings.viewerCanSeeIndividualReports': 1 })
      .lean()
      .exec();

    if (!organization) {
      ctx.status = 404;
      ctx.body = { error: 'Organização não encontrada' };
      return;
    }

    const viewerCanSeeIndividualReports = Boolean(organization.settings?.viewerCanSeeIndividualReports);
    ctx.body = { permissions: { viewerCanSeeIndividualReports } };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/settings/permissions:
 *   put:
 *     tags:
 *       - Organization
 *     summary: Atualiza permissões globais de visibilidade da organização
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - viewerCanSeeIndividualReports
 *             properties:
 *               viewerCanSeeIndividualReports:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Permissões atualizadas com sucesso
 */
organizationSettingsRouter.put('/settings/permissions', async (ctx) => {
  try {
    const organizationId = getOrganizationId(ctx);
    assertOwnerAdminRole(ctx, organizationId);

    const payload = ctx.request.body as { viewerCanSeeIndividualReports?: unknown } | undefined;
    if (typeof payload?.viewerCanSeeIndividualReports !== 'boolean') {
      ctx.status = 400;
      ctx.body = { error: 'viewerCanSeeIndividualReports deve ser booleano' };
      return;
    }

    const organization = await OrganizationModel.findByIdAndUpdate(
      organizationId,
      { $set: { 'settings.viewerCanSeeIndividualReports': payload.viewerCanSeeIndividualReports } },
      { new: true },
    )
      .select({ 'settings.viewerCanSeeIndividualReports': 1 })
      .lean()
      .exec();

    if (!organization) {
      ctx.status = 404;
      ctx.body = { error: 'Organização não encontrada' };
      return;
    }

    ctx.body = {
      permissions: {
        viewerCanSeeIndividualReports: Boolean(organization.settings?.viewerCanSeeIndividualReports),
      },
    };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});
