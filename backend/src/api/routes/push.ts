import Router from '@koa/router';
import { Types } from 'mongoose';
import {
  getVapidPublicKey,
  registerPushSubscription,
  unregisterPushSubscription,
  type BrowserPushSubscription,
} from '../../services/pushService';

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
 * Payload para endpoint de inscrição de web push.
 */
interface SubscribePushBody {
  subscription?: BrowserPushSubscription;
}

/**
 * Payload para endpoint de remoção de web push.
 */
interface UnsubscribePushBody {
  endpoint?: string;
}

/** Rotas protegidas para gerenciamento de assinaturas Web Push. */
export const pushRouter = new Router();

/**
 * Obtém identidade autenticada da requisição.
 * @param {Router.RouterContext} ctx Contexto Koa da requisição.
 * @returns {{ organizationId: string; userId: string }} IDs de organização e usuário autenticado.
 * @throws {Error} Quando contexto não possui tenant/usuário válidos.
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
 * Valida payload de subscribe e retorna assinatura normalizada.
 * @param {SubscribePushBody | undefined} body Corpo JSON recebido.
 * @returns {BrowserPushSubscription} Assinatura pronta para persistência.
 * @throws {Error} Quando payload estiver inválido.
 */
function parseSubscribeBody(body: SubscribePushBody | undefined): BrowserPushSubscription {
  const subscription = body?.subscription;
  if (!subscription?.endpoint?.trim()) {
    throw new Error('subscription.endpoint é obrigatório');
  }
  if (!subscription?.keys?.p256dh?.trim() || !subscription?.keys?.auth?.trim()) {
    throw new Error('subscription.keys.p256dh e subscription.keys.auth são obrigatórios');
  }

  return {
    endpoint: subscription.endpoint.trim(),
    keys: {
      p256dh: subscription.keys.p256dh.trim(),
      auth: subscription.keys.auth.trim(),
    },
    expirationTime: subscription.expirationTime ?? null,
  };
}

/**
 * @openapi
 * /org/{orgId}/push/public-key:
 *   get:
 *     tags:
 *       - Push
 *     summary: Retorna chave pública VAPID usada pelo frontend para inscrição web push
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Chave pública VAPID disponível
 *       503:
 *         description: Web Push desabilitado por falta de configuração
 */
pushRouter.get('/push/public-key', async (ctx) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    ctx.status = 503;
    ctx.body = { error: 'Web Push desabilitado: VAPID_PUBLIC_KEY ausente' };
    return;
  }

  ctx.body = { publicKey };
});

/**
 * @openapi
 * /org/{orgId}/push/subscribe:
 *   post:
 *     tags:
 *       - Push
 *     summary: Registra assinatura do navegador para notificações web push
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Assinatura registrada com sucesso
 *       400:
 *         description: Payload inválido
 */
pushRouter.post('/push/subscribe', async (ctx) => {
  try {
    const { organizationId, userId } = getRequestIdentity(ctx);
    const subscription = parseSubscribeBody(ctx.request.body as SubscribePushBody | undefined);

    await registerPushSubscription({
      organizationId,
      userId,
      subscription,
      userAgent: ctx.headers['user-agent'],
    });

    ctx.status = 204;
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/push/unsubscribe:
 *   post:
 *     tags:
 *       - Push
 *     summary: Remove assinatura web push do navegador atual
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Assinatura removida (idempotente)
 *       400:
 *         description: Endpoint inválido
 */
pushRouter.post('/push/unsubscribe', async (ctx) => {
  try {
    const { organizationId, userId } = getRequestIdentity(ctx);
    const endpoint = (ctx.request.body as UnsubscribePushBody | undefined)?.endpoint;
    if (!endpoint?.trim()) {
      throw new Error('endpoint é obrigatório');
    }

    await unregisterPushSubscription({
      organizationId,
      userId,
      endpoint: endpoint.trim(),
    });

    ctx.status = 204;
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 400;
    ctx.status = status;
    ctx.body = { error: (error as Error).message };
  }
});
