import Router from '@koa/router';
import Stripe from 'stripe';
import { activateSubscriptionFromCheckoutSession } from '../../../services/billingService';

/** Rota pública de webhook Stripe. */
export const stripeWebhookRouter = new Router();

/**
 * Constrói evento Stripe validando assinatura HMAC com corpo bruto.
 * @param rawBody Corpo UTF-8 exatamente como recebido
 * @param signature Header Stripe-Signature
 * @returns Evento Stripe verificado
 * @throws {Error} Quando assinatura, secret ou payload estiver inválido
 */
function buildStripeEvent(rawBody: string, signature: string | undefined): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!webhookSecret || !stripeSecretKey) {
    throw new Error('Webhook Stripe não configurado');
  }
  if (!signature?.trim()) {
    throw new Error('Assinatura Stripe ausente');
  }
  if (!rawBody.trim()) {
    throw new Error('Corpo do webhook Stripe ausente');
  }

  const stripe = new Stripe(stripeSecretKey);
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

/**
 * @openapi
 * /webhooks/stripe:
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: Recebe eventos do Stripe para atualização de assinatura
 */
stripeWebhookRouter.post('/webhooks/stripe', async (ctx) => {
  const signature = ctx.get('Stripe-Signature');
  const rawBody = ctx.state.stripeRawBody as string | undefined;

  try {
    const event = buildStripeEvent(rawBody ?? '', signature);
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
