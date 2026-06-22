import Router from '@koa/router';
import { createCheckoutSession } from '../../services/billingService';

/**
 * Payload esperado para iniciar Stripe Checkout.
 */
interface CheckoutSessionPayload {
  planSlug?: string;
  successUrl?: string;
  cancelUrl?: string;
  customerEmail?: string;
}

/** Rotas protegidas de billing por organização. */
export const billingRouter = new Router();

/**
 * @openapi
 * /org/{orgId}/billing/checkout-session:
 *   post:
 *     tags:
 *       - Plans
 *     summary: Cria sessão de checkout Stripe para assinatura
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planSlug
 *               - successUrl
 *               - cancelUrl
 *             properties:
 *               planSlug:
 *                 type: string
 *               successUrl:
 *                 type: string
 *               cancelUrl:
 *                 type: string
 *               customerEmail:
 *                 type: string
 *     responses:
 *       201:
 *         description: Sessão de checkout criada
 *       400:
 *         description: Payload inválido
 */
billingRouter.post('/billing/checkout-session', async (ctx) => {
  const organizationId = ctx.state.organizationId as string | undefined;
  const payload = (ctx.request.body ?? {}) as CheckoutSessionPayload;
  if (!organizationId) {
    ctx.status = 400;
    ctx.body = { error: 'organizationId ausente no contexto autenticado' };
    return;
  }

  if (!payload.planSlug || !payload.successUrl || !payload.cancelUrl) {
    ctx.status = 400;
    ctx.body = { error: 'planSlug, successUrl e cancelUrl são obrigatórios' };
    return;
  }

  try {
    const checkoutSession = await createCheckoutSession({
      organizationId,
      planSlug: payload.planSlug,
      successUrl: payload.successUrl,
      cancelUrl: payload.cancelUrl,
      customerEmail: payload.customerEmail,
    });

    ctx.status = 201;
    ctx.body = checkoutSession;
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});
