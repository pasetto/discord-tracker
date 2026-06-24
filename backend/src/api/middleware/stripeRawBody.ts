import type { IncomingMessage } from 'http';
import { Context, Next } from 'koa';

const STRIPE_WEBHOOK_PATH = '/api/v1/webhooks/stripe';

/**
 * Lê o corpo bruto de uma requisição HTTP.
 * @param req Stream da requisição Node
 * @returns Corpo UTF-8
 */
function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Captura corpo bruto do webhook Stripe antes do body parser JSON.
 * @param ctx Contexto Koa
 * @param next Próximo middleware
 */
export async function stripeRawBodyMiddleware(ctx: Context, next: Next): Promise<void> {
  if (ctx.path !== STRIPE_WEBHOOK_PATH || ctx.method.toUpperCase() !== 'POST') {
    await next();
    return;
  }

  const rawBody = await readRawBody(ctx.req);
  ctx.state.stripeRawBody = rawBody;
  await next();
}

/**
 * Pula o body parser quando o corpo Stripe já foi lido como raw.
 * @param ctx Contexto Koa
 * @param next Próximo middleware
 */
export async function skipBodyParserWhenStripeRaw(ctx: Context, next: Next): Promise<void> {
  if (ctx.state.stripeRawBody) {
    await next();
    return;
  }

  const bodyParser = (await import('koa-bodyparser')).default;
  await bodyParser({ jsonLimit: '1mb' })(ctx, next);
}
