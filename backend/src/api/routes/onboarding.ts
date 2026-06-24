import Router from '@koa/router';
import { OrganizationModel, type IOnboardingProgress } from '../../db/models/Organization';

const MANAGER_ROLES = new Set(['owner', 'admin', 'manager']);
const VIEWER_ROLES = new Set(['owner', 'admin', 'manager', 'viewer']);

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
  memberships?: JwtMembership[];
}

/**
 * Payload de atualização parcial do onboarding.
 */
interface OnboardingPayload {
  onboarding?: Partial<IOnboardingProgress>;
}

/** Rotas de progresso do onboarding em 8 passos. */
export const onboardingRouter = new Router();

/**
 * Calcula role do usuário no tenant autenticado.
 * @param {Router.RouterContext} ctx Contexto Koa da requisição
 * @param {string} organizationId Identificador da organização autenticada
 * @returns {string | undefined} Papel do usuário em minúsculas
 */
function getMembershipRole(ctx: Router.RouterContext, organizationId: string): string | undefined {
  const user = ctx.state.user as JwtUserShape | undefined;
  const membership = user?.memberships?.find((item) => item.organizationId === organizationId);
  return membership?.role?.toLowerCase();
}

/**
 * Garante permissão mínima de leitura de onboarding.
 * @param {Router.RouterContext} ctx Contexto Koa da requisição
 * @param {string} organizationId Organização alvo
 * @returns {void} Não retorna valor
 */
function assertViewerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !VIEWER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para visualizar onboarding');
  }
}

/**
 * Garante permissão de gestão para atualizar onboarding.
 * @param {Router.RouterContext} ctx Contexto Koa da requisição
 * @param {string} organizationId Organização alvo
 * @returns {void} Não retorna valor
 */
function assertManagerRole(ctx: Router.RouterContext, organizationId: string): void {
  const role = getMembershipRole(ctx, organizationId);
  if (!role || !MANAGER_ROLES.has(role)) {
    ctx.throw(403, 'Permissão insuficiente para atualizar onboarding');
  }
}

/**
 * Normaliza e valida payload parcial de onboarding.
 * @param {Partial<IOnboardingProgress> | undefined} onboarding Payload recebido
 * @returns {Partial<IOnboardingProgress>} Payload pronto para persistência
 * @throws {Error} Quando algum campo for inválido
 */
function sanitizeOnboardingPayload(
  onboarding: Partial<IOnboardingProgress> | undefined,
): Partial<IOnboardingProgress> {
  if (!onboarding || typeof onboarding !== 'object') {
    throw new Error('Payload inválido. Envie { onboarding: { ... } }');
  }

  const sanitized: Partial<IOnboardingProgress> = {};
  const booleanFields: Array<keyof Pick<
    IOnboardingProgress,
    | 'botConnected'
    | 'guildSelected'
    | 'channelsConfigured'
    | 'calendarConfigured'
    | 'categoriesConfigured'
    | 'membersAssigned'
  >> = [
    'botConnected',
    'guildSelected',
    'channelsConfigured',
    'calendarConfigured',
    'categoriesConfigured',
    'membersAssigned',
  ];

  for (const field of booleanFields) {
    const value = onboarding[field];
    if (value !== undefined) {
      if (typeof value !== 'boolean') {
        throw new Error(`${field} deve ser boolean`);
      }
      sanitized[field] = value;
    }
  }

  if (onboarding.currentStep !== undefined) {
    if (!Number.isInteger(onboarding.currentStep) || onboarding.currentStep < 1 || onboarding.currentStep > 8) {
      throw new Error('currentStep deve ser um inteiro entre 1 e 8');
    }
    sanitized.currentStep = onboarding.currentStep;
  }

  if (onboarding.completedSteps !== undefined) {
    if (!Array.isArray(onboarding.completedSteps)) {
      throw new Error('completedSteps deve ser um array');
    }
    const completedSteps = [...new Set(onboarding.completedSteps.filter((step) => Number.isInteger(step) && step >= 1 && step <= 8))];
    sanitized.completedSteps = completedSteps.sort((left, right) => left - right);
  }

  if (onboarding.completedAt !== undefined) {
    const completedAt = onboarding.completedAt instanceof Date ? onboarding.completedAt : new Date(onboarding.completedAt);
    if (Number.isNaN(completedAt.getTime())) {
      throw new Error('completedAt inválido');
    }
    sanitized.completedAt = completedAt;
  }

  return sanitized;
}

/**
 * @openapi
 * /org/{orgId}/onboarding:
 *   get:
 *     tags:
 *       - Organizations
 *     summary: Retorna progresso do onboarding da organização
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Progresso atual do onboarding
 */
onboardingRouter.get('/onboarding', async (ctx) => {
  try {
    const organizationId = ctx.state.organizationId as string | undefined;
    if (!organizationId) {
      ctx.status = 400;
      ctx.body = { error: 'organizationId ausente no contexto autenticado' };
      return;
    }

    assertViewerRole(ctx, organizationId);
    const organization = await OrganizationModel.findById(organizationId, { onboarding: 1 });
    if (!organization) {
      ctx.status = 404;
      ctx.body = { error: 'Organização não encontrada' };
      return;
    }

    ctx.body = { onboarding: organization.onboarding };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/onboarding:
 *   put:
 *     tags:
 *       - Organizations
 *     summary: Atualiza progresso do onboarding da organização
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Progresso atualizado com sucesso
 */
onboardingRouter.put('/onboarding', async (ctx) => {
  try {
    const organizationId = ctx.state.organizationId as string | undefined;
    const payload = ctx.request.body as OnboardingPayload | undefined;

    if (!organizationId) {
      ctx.status = 400;
      ctx.body = { error: 'organizationId ausente no contexto autenticado' };
      return;
    }

    assertManagerRole(ctx, organizationId);
    const onboardingPatch = sanitizeOnboardingPayload(payload?.onboarding);
    const organization = await OrganizationModel.findById(organizationId, { onboarding: 1 });

    if (!organization) {
      ctx.status = 404;
      ctx.body = { error: 'Organização não encontrada' };
      return;
    }

    const currentOnboarding =
      typeof organization.onboarding?.toObject === 'function'
        ? organization.onboarding.toObject()
        : { ...organization.onboarding };
    const mergedOnboarding = { ...currentOnboarding, ...onboardingPatch };

    organization.onboarding = mergedOnboarding;
    await organization.save();

    ctx.body = { onboarding: organization.onboarding };
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});
