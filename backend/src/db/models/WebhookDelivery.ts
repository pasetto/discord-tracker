import { Document, Schema, Types, model } from 'mongoose';
import type { OutboundWebhookEvent } from './WebhookEndpoint';
import { OUTBOUND_WEBHOOK_EVENTS } from './WebhookEndpoint';

/**
 * Status de processamento de uma entrega webhook.
 */
export type WebhookDeliveryStatus = 'pending' | 'delivering' | 'success' | 'failed' | 'dead';

/**
 * Documento de entrega assíncrona de webhook outbound.
 */
export interface IWebhookDelivery extends Document {
  organizationId: Types.ObjectId;
  endpointId: Types.ObjectId;
  event: OutboundWebhookEvent;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt?: Date;
  lastHttpStatus?: number;
  lastError?: string;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const webhookDeliverySchema = new Schema<IWebhookDelivery>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    endpointId: { type: Schema.Types.ObjectId, ref: 'WebhookEndpoint', required: true, index: true },
    event: { type: String, required: true, enum: OUTBOUND_WEBHOOK_EVENTS },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, required: true, enum: ['pending', 'delivering', 'success', 'failed', 'dead'], default: 'pending' },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    maxAttempts: { type: Number, required: true, default: 5, min: 1, max: 5 },
    nextRetryAt: { type: Date, required: false, index: true },
    lastHttpStatus: { type: Number, required: false },
    lastError: { type: String, required: false, trim: true, maxlength: 2000 },
    deliveredAt: { type: Date, required: false },
  },
  { timestamps: true },
);

webhookDeliverySchema.index({ status: 1, nextRetryAt: 1, createdAt: 1 });
webhookDeliverySchema.index({ organizationId: 1, endpointId: 1, createdAt: -1 });

/** Model Mongoose para collection webhook_deliveries. */
export const WebhookDeliveryModel = model<IWebhookDelivery>('WebhookDelivery', webhookDeliverySchema);
