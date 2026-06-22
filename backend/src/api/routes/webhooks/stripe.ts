import Router from '@koa/router';
import Stripe from 'stripe';
import { activateSubscriptionFromCheckoutSession } from '../../../services/billingService';

/** Rota pública de webhook Stripe. */
export const stripeWebhookRouter = new Router();

/**
 * Constrói evento Stripe validando assinatura quando possível.
 * @param body Body parseado do request
 * @param signature Header Stripe-Signature
 * @returns Evento Stripe com tipagem mínima para processamento
 * @throws {Error} Quando assinatura/evento estiver inválido
 */
function buildStripeEvent(body: unknown, signature: string | undefined): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (webhookSecret && stripeSecretKey && signature && typeof body === 'string') {
    const stripe = new Stripe(stripeSecretKey);
    return stripe.webhooks.constructEvent(body, signature, webhookSecret);
  }

  if (body && typeof body === 'object' && 'type' in body && 'data' in body) {
    return body as Stripe.Event;
  }

  throw new Error('Evento Stripe inválido');
}

/**
 * @openapi
 * /webhooks/stripe:
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: Recebe eventos do Stripe para atualização de assinatura
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Evento processado
 *       400:
 *         description: Evento inválido
 */
stripeWebhookRouter.post('/webhooks/stripe', async (ctx) => {
  const signature = ctx.get('Stripe-Signature');

  try {
    const event = buildStripeEvent(ctx.request.body, signature);
    if (event.type === 'checkout.session.completed') {
      await activateSubscriptionFromCheckoutSession(event.data.object as Stripe.Checkout.Session);
    }

    ctx.status = 200;
    ctx.body = { received: true };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});
