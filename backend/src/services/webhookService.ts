import { createHmac } from 'crypto';
import { Types } from 'mongoose';
import { WebhookEndpointModel } from '../db/models/WebhookEndpoint';
import type { OutboundWebhookEvent } from '../db/models/WebhookEndpoint';
import { WebhookDeliveryModel } from '../db/models/WebhookDelivery';
import { createLogger } from '../logger';

const log = createLogger('webhook-service');

/** Backoff exponencial MVP para retries de entrega webhook. */
export const WEBHOOK_RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 24 * 60 * 60_000] as const;

/** Número máximo de tentativas por entrega webhook no MVP. */
export const WEBHOOK_MAX_ATTEMPTS = 5;

/**
 * Entrada para enfileirar entregas webhook de um evento de domínio.
 */
export interface EnqueueWebhookDeliveriesInput {
  organizationId: string;
  event: OutboundWebhookEvent;
  payload: Record<string, unknown>;
}

/**
 * Resultado do processamento de uma entrega individual.
 */
export type ProcessWebhookDeliveryResult = 'success' | 'retry_scheduled' | 'dead' | 'skipped';

/**
 * Converte string para ObjectId com validação.
 * @param value Identificador textual recebido da camada de API/serviço.
 * @param field Nome lógico do campo para mensagem de erro.
 * @returns ObjectId válido para uso em filtros e persistência.
 * @throws {Error} Quando o identificador informado não for um ObjectId válido.
 */
function toObjectId(value: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${field} inválido`);
  }

  return new Types.ObjectId(value);
}

/**
 * Retorna filtro para entregas pendentes aptas a retry imediato.
 * @param now Instante de referência para comparação de agendamento.
 * @returns Filtro compatível com Mongoose para `nextRetryAt`.
 */
function buildDueRetryFilter(now: Date): { $or: Array<Record<string, unknown>> } {
  return {
    $or: [{ nextRetryAt: { $exists: false } }, { nextRetryAt: null }, { nextRetryAt: { $lte: now } }],
  };
}

/**
 * Assina payload JSON com HMAC-SHA256 no formato esperado pelo header do webhook.
 * @param secret Segredo compartilhado configurado no endpoint.
 * @param rawBody Corpo JSON serializado exatamente como será enviado.
 * @returns Assinatura no formato `sha256=<digest_hex>`.
 */
export function signWebhookPayload(secret: string, rawBody: string): string {
  const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
  return `sha256=${digest}`;
}

/**
 * Calcula próxima data de retry com base no número atual de tentativas.
 * @param attempts Quantidade atual de tentativas já executadas.
 * @param now Instante base para cálculo do próximo retry.
 * @returns Próximo instante de retry, ou `undefined` quando ultrapassa janela configurada.
 * @example
 * calculateNextRetryAt(1, new Date('2026-06-22T12:00:00.000Z'))?.toISOString()
 * // 2026-06-22T12:01:00.000Z
 */
export function calculateNextRetryAt(attempts: number, now: Date = new Date()): Date | undefined {
  const delay = WEBHOOK_RETRY_DELAYS_MS[attempts - 1];
  if (typeof delay !== 'number') {
    return undefined;
  }

  return new Date(now.getTime() + delay);
}

/**
 * Enfileira entregas para todos os endpoints ativos inscritos em um evento.
 * @param input Organização, evento e payload para fan-out das entregas.
 * @returns Quantidade de entregas criadas na fila interna.
 */
export async function enqueueWebhookDeliveries(input: EnqueueWebhookDeliveriesInput): Promise<number> {
  const organizationId = toObjectId(input.organizationId, 'organizationId');
  const endpoints = await WebhookEndpointModel.find({
    organizationId,
    isActive: true,
    events: input.event,
  }).lean();

  if (endpoints.length === 0) {
    return 0;
  }

  const deliveries = endpoints.map((endpoint) => ({
    organizationId,
    endpointId: endpoint._id,
    event: input.event,
    payload: input.payload,
    status: 'pending' as const,
    attempts: 0,
    maxAttempts: WEBHOOK_MAX_ATTEMPTS,
  }));

  await WebhookDeliveryModel.insertMany(deliveries, { ordered: false });
  return deliveries.length;
}

/**
 * Processa uma entrega específica com claim atômico e atualização de status final.
 * @param deliveryId Identificador textual da entrega a ser processada.
 * @param now Instante de referência para scheduling de retry.
 * @returns Resultado do processamento (`success`, `retry_scheduled`, `dead` ou `skipped`).
 */
export async function processWebhookDelivery(deliveryId: string, now: Date = new Date()): Promise<ProcessWebhookDeliveryResult> {
  const deliveryObjectId = toObjectId(deliveryId, 'deliveryId');
  const claimedDelivery = await WebhookDeliveryModel.findOneAndUpdate(
    {
      _id: deliveryObjectId,
      status: 'pending',
      ...buildDueRetryFilter(now),
    },
    {
      $set: { status: 'delivering' },
      $inc: { attempts: 1 },
    },
    { new: true },
  ).lean();

  if (!claimedDelivery) {
    return 'skipped';
  }

  const endpoint = await WebhookEndpointModel.findOne({
    _id: claimedDelivery.endpointId,
    organizationId: claimedDelivery.organizationId,
  }).lean();

  if (!endpoint || !endpoint.isActive) {
    await WebhookDeliveryModel.updateOne(
      { _id: claimedDelivery._id },
      {
        $set: {
          status: 'dead',
          lastError: 'Endpoint webhook não encontrado ou inativo',
          nextRetryAt: undefined,
        },
      },
    );
    return 'dead';
  }

  const body = JSON.stringify(claimedDelivery.payload ?? {});
  const headers = {
    'Content-Type': 'application/json',
    'X-Syntra-Event': claimedDelivery.event,
    'X-Syntra-Delivery-Id': String(claimedDelivery._id),
    'X-Syntra-Signature': signWebhookPayload(endpoint.secret, body),
  };

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body,
    });

    if (response.ok) {
      await WebhookDeliveryModel.updateOne(
        { _id: claimedDelivery._id },
        {
          $set: {
            status: 'success',
            lastHttpStatus: response.status,
            deliveredAt: now,
            nextRetryAt: undefined,
            lastError: undefined,
          },
        },
      );
      await WebhookEndpointModel.updateOne(
        { _id: endpoint._id },
        {
          $set: {
            failureCount: 0,
            lastSuccessAt: now,
          },
        },
      );

      return 'success';
    }

    const responseText = await response.text();
    const errorMessage = `HTTP ${response.status}${responseText ? ` - ${responseText.slice(0, 500)}` : ''}`;

    return await markFailedDelivery({
      deliveryId: String(claimedDelivery._id),
      endpointId: String(endpoint._id),
      attempts: claimedDelivery.attempts,
      maxAttempts: claimedDelivery.maxAttempts,
      httpStatus: response.status,
      errorMessage,
      now,
    });
  } catch (error) {
    const errorMessage = (error as Error).message || 'Falha desconhecida ao chamar endpoint webhook';
    return await markFailedDelivery({
      deliveryId: String(claimedDelivery._id),
      endpointId: String(endpoint._id),
      attempts: claimedDelivery.attempts,
      maxAttempts: claimedDelivery.maxAttempts,
      httpStatus: undefined,
      errorMessage,
      now,
    });
  }
}

/**
 * Processa lote de entregas pendentes aptas (FIFO por criação).
 * @param limit Quantidade máxima de entregas tentadas no ciclo.
 * @param now Instante de referência para due-date/retry.
 * @returns Quantidade de entregas efetivamente processadas no ciclo.
 */
export async function processPendingWebhookDeliveries(limit: number = 20, now: Date = new Date()): Promise<number> {
  const dueDeliveries = await WebhookDeliveryModel.find({
    status: 'pending',
    ...buildDueRetryFilter(now),
  })
    .select({ _id: 1 })
    .sort({ createdAt: 1 })
    .limit(Math.max(1, Math.trunc(limit)))
    .lean()
    .exec();

  let processed = 0;
  for (const delivery of dueDeliveries) {
    const result = await processWebhookDelivery(String(delivery._id), now);
    if (result !== 'skipped') {
      processed += 1;
    }
  }

  return processed;
}

/**
 * Atualiza status de falha com retry exponencial ou marca como dead-letter.
 * @param input Dados mínimos para persistência de falha e cálculo do próximo estado.
 * @returns Estado final para fluxo de controle do chamador.
 */
async function markFailedDelivery(input: {
  deliveryId: string;
  endpointId: string;
  attempts: number;
  maxAttempts: number;
  httpStatus?: number;
  errorMessage: string;
  now: Date;
}): Promise<ProcessWebhookDeliveryResult> {
  const hasAttemptsRemaining = input.attempts < input.maxAttempts;
  const nextRetryAt = hasAttemptsRemaining ? calculateNextRetryAt(input.attempts, input.now) : undefined;
  const nextStatus = hasAttemptsRemaining && nextRetryAt ? 'pending' : 'dead';

  await WebhookDeliveryModel.updateOne(
    { _id: toObjectId(input.deliveryId, 'deliveryId') },
    {
      $set: {
        status: nextStatus,
        nextRetryAt,
        lastHttpStatus: input.httpStatus,
        lastError: input.errorMessage,
      },
    },
  );
  await WebhookEndpointModel.updateOne(
    { _id: toObjectId(input.endpointId, 'endpointId') },
    {
      $inc: { failureCount: 1 },
      $set: { lastFailureAt: input.now },
    },
  );

  if (nextStatus === 'dead') {
    log.warn(
      {
        deliveryId: input.deliveryId,
        attempts: input.attempts,
        errorMessage: input.errorMessage,
      },
      'Entrega webhook enviada para dead-letter',
    );
    return 'dead';
  }

  return 'retry_scheduled';
}
