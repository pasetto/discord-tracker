import Router from '@koa/router';
import { randomBytes } from 'crypto';
import { Types, isValidObjectId } from 'mongoose';
import { WebhookEndpointModel } from '../../db/models/WebhookEndpoint';
import { OUTBOUND_WEBHOOK_EVENTS } from '../../db/models/WebhookEndpoint';
import type { OutboundWebhookEvent } from '../../db/models/WebhookEndpoint';
import { assertPublicHttpsUrl } from '../../utils/urlSecurity';
import { assertManagerRole } from '../middleware/tenantRbac';

/**
 * Shape mínimo do usuário autenticado disponível em `ctx.state.user`.
 */
interface JwtUserShape {
  id?: string;
}

/**
 * Payload aceito na criação de endpoint webhook.
 */
interface CreateWebhookEndpointBody {
  name?: string;
  url?: string;
  events?: OutboundWebhookEvent[];
  isActive?: boolean;
}

/**
 * Payload aceito na atualização de endpoint webhook.
 */
interface UpdateWebhookEndpointBody {
  name?: string;
  url?: string;
  events?: OutboundWebhookEvent[];
  isActive?: boolean;
}

/** Rotas CRUD para endpoints de webhook outbound por organização. */
export const webhooksRouter = new Router();

/**
 * Gera segredo aleatório para assinatura HMAC de um endpoint webhook.
 * @returns Segredo hexadecimal com 64 caracteres.
 */
function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Converte string para ObjectId com validação.
 * @param value Valor textual recebido no request.
 * @param field Nome do campo para mensagem de erro.
 * @returns ObjectId válido.
 * @throws {Error} Quando o valor não for ObjectId válido.
 */
function toObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${field} inválido`);
  }

  return new Types.ObjectId(value);
}

/**
 * Remove o segredo sensível do endpoint antes de retornar ao cliente.
 * @param endpoint Documento/objeto do endpoint persistido.
 * @returns Endpoint seguro para resposta pública.
 */
function toSafeEndpointResponse(endpoint: {
  _id: unknown;
  organizationId: unknown;
  name: string;
  url: string;
  events: OutboundWebhookEvent[];
  isActive: boolean;
  failureCount: number;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  createdBy: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> {
  return {
    id: String(endpoint._id),
    organizationId: String(endpoint.organizationId),
    name: endpoint.name,
    url: endpoint.url,
    events: endpoint.events,
    isActive: endpoint.isActive,
    failureCount: endpoint.failureCount,
    lastSuccessAt: endpoint.lastSuccessAt,
    lastFailureAt: endpoint.lastFailureAt,
    createdBy: String(endpoint.createdBy),
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
  };
}

/**
 * Valida URL HTTPS informada para endpoint webhook.
 * @param url URL textual enviada no payload.
 * @returns URL normalizada pronta para persistência.
 * @throws {Error} Quando URL estiver ausente, inválida ou sem HTTPS.
 */
function parseWebhookUrl(url: string | undefined): string {
  return assertPublicHttpsUrl(url);
}

/**
 * Valida lista de eventos selecionados para endpoint webhook.
 * @param events Lista de eventos recebida no payload.
 * @returns Lista normalizada de eventos sem duplicidades.
 * @throws {Error} Quando lista estiver vazia ou contiver eventos inválidos.
 */
function parseWebhookEvents(events: OutboundWebhookEvent[] | undefined): OutboundWebhookEvent[] {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('events deve conter ao menos um evento');
  }

  const normalized = Array.from(new Set(events.map((event) => String(event).trim() as OutboundWebhookEvent)));
  const invalidEvent = normalized.find((event) => !OUTBOUND_WEBHOOK_EVENTS.includes(event));
  if (invalidEvent) {
    throw new Error(`Evento webhook inválido: ${invalidEvent}`);
  }

  return normalized;
}

/**
 * Obtém `organizationId` e `userId` do contexto autenticado.
 * @param ctx Contexto Koa da requisição.
 * @returns Identidade autenticada para escopo multitenant.
 * @throws {Error} Quando organizationId ou userId estiver ausente/inválido.
 */
function getRequestIdentity(ctx: Router.RouterContext): { organizationId: string; userId: string } {
  const organizationId = ctx.state.organizationId as string | undefined;
  const userId = (ctx.state.user as JwtUserShape | undefined)?.id;

  if (!organizationId) {
    throw new Error('organizationId ausente no contexto autenticado');
  }
  if (!userId || !isValidObjectId(userId)) {
    throw new Error('Usuário autenticado inválido');
  }

  return { organizationId, userId };
}

/**
 * @openapi
 * /org/{orgId}/webhooks:
 *   get:
 *     tags:
 *       - Webhooks
 *     summary: Lista endpoints de webhook outbound da organização
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Endpoints retornados com sucesso
 */
webhooksRouter.get('/webhooks', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    const endpoints = await WebhookEndpointModel.find({ organizationId })
      .sort({ createdAt: -1 })
      .lean();

    ctx.body = { endpoints: endpoints.map((endpoint) => toSafeEndpointResponse(endpoint)) };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/webhooks:
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: Cria endpoint webhook outbound com segredo HMAC
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Endpoint criado com segredo inicial
 *       400:
 *         description: Payload inválido
 */
webhooksRouter.post('/webhooks', async (ctx) => {
  try {
    const { organizationId, userId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);
    const payload = (ctx.request.body as CreateWebhookEndpointBody | undefined) ?? {};

    const endpoint = await WebhookEndpointModel.create({
      organizationId: toObjectId(organizationId, 'organizationId'),
      name: payload.name?.trim(),
      url: parseWebhookUrl(payload.url),
      secret: generateWebhookSecret(),
      events: parseWebhookEvents(payload.events),
      isActive: payload.isActive ?? true,
      failureCount: 0,
      createdBy: toObjectId(userId, 'userId'),
    });

    ctx.status = 201;
    ctx.body = {
      endpoint: toSafeEndpointResponse(endpoint),
      secret: endpoint.secret,
      warning: 'Guarde o secret agora. Ele não será exibido novamente.',
    };
  } catch (error) {
    const message = (error as Error).message;
    ctx.status = message.includes('Permissão insuficiente') ? 403 : 400;
    ctx.body = { error: message };
  }
});

/**
 * @openapi
 * /org/{orgId}/webhooks/{id}:
 *   get:
 *     tags:
 *       - Webhooks
 *     summary: Retorna endpoint webhook específico da organização
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Endpoint encontrado
 *       404:
 *         description: Endpoint não encontrado
 */
webhooksRouter.get('/webhooks/:id', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    if (!isValidObjectId(ctx.params.id)) {
      ctx.status = 400;
      ctx.body = { error: 'id inválido' };
      return;
    }

    const endpoint = await WebhookEndpointModel.findOne({
      _id: ctx.params.id,
      organizationId,
    }).lean();
    if (!endpoint) {
      ctx.status = 404;
      ctx.body = { error: 'Endpoint webhook não encontrado' };
      return;
    }

    ctx.body = { endpoint: toSafeEndpointResponse(endpoint) };
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: (error as Error).message };
  }
});

/**
 * @openapi
 * /org/{orgId}/webhooks/{id}:
 *   put:
 *     tags:
 *       - Webhooks
 *     summary: Atualiza endpoint webhook outbound da organização
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Endpoint atualizado
 *       404:
 *         description: Endpoint não encontrado
 */
webhooksRouter.put('/webhooks/:id', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);
    const endpointId = ctx.params.id;
    if (!isValidObjectId(endpointId)) {
      ctx.status = 400;
      ctx.body = { error: 'id inválido' };
      return;
    }

    const payload = (ctx.request.body as UpdateWebhookEndpointBody | undefined) ?? {};
    const updates: Record<string, unknown> = {};
    if (typeof payload.name === 'string') {
      const name = payload.name.trim();
      if (!name) {
        throw new Error('name inválido');
      }
      updates.name = name;
    }
    if (typeof payload.url === 'string') {
      updates.url = parseWebhookUrl(payload.url);
    }
    if (Array.isArray(payload.events)) {
      updates.events = parseWebhookEvents(payload.events);
    }
    if (typeof payload.isActive === 'boolean') {
      updates.isActive = payload.isActive;
    }

    if (Object.keys(updates).length === 0) {
      throw new Error('Nenhum campo válido para atualização');
    }

    const endpoint = await WebhookEndpointModel.findOneAndUpdate(
      {
        _id: endpointId,
        organizationId,
      },
      { $set: updates },
      { new: true },
    ).lean();

    if (!endpoint) {
      ctx.status = 404;
      ctx.body = { error: 'Endpoint webhook não encontrado' };
      return;
    }

    ctx.body = { endpoint: toSafeEndpointResponse(endpoint) };
  } catch (error) {
    const message = (error as Error).message;
    ctx.status = message.includes('Permissão insuficiente') ? 403 : 400;
    ctx.body = { error: message };
  }
});

/**
 * @openapi
 * /org/{orgId}/webhooks/{id}:
 *   delete:
 *     tags:
 *       - Webhooks
 *     summary: Remove endpoint webhook outbound da organização
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Endpoint removido com sucesso
 *       404:
 *         description: Endpoint não encontrado
 */
webhooksRouter.delete('/webhooks/:id', async (ctx) => {
  try {
    const { organizationId } = getRequestIdentity(ctx);
    assertManagerRole(ctx, organizationId);
    const endpointId = ctx.params.id;
    if (!isValidObjectId(endpointId)) {
      ctx.status = 400;
      ctx.body = { error: 'id inválido' };
      return;
    }

    const deleted = await WebhookEndpointModel.findOneAndDelete({
      _id: endpointId,
      organizationId,
    }).lean();
    if (!deleted) {
      ctx.status = 404;
      ctx.body = { error: 'Endpoint webhook não encontrado' };
      return;
    }

    ctx.status = 204;
  } catch (error) {
    const message = (error as Error).message;
    ctx.status = message.includes('Permissão insuficiente') ? 403 : 400;
    ctx.body = { error: message };
  }
});
