import { Document, Schema, Types, model } from 'mongoose';

/**
 * Lista de eventos outbound suportados para integração de webhooks.
 */
export const OUTBOUND_WEBHOOK_EVENTS = [
  'daily_report.generated',
  'member.collaboration_hours.threshold',
  'member.inactivity.detected',
  'member.collaboration_goal.behind',
  'member.streak.achieved',
  'member.category.updated',
  'ranking.period.finalized',
  'channel_rules.updated',
  'subscription.plan_changed',
  'bot.guild_disconnected',
  'member.afk.extended',
] as const;

/**
 * Evento outbound aceito pelo Syntra.
 */
export type OutboundWebhookEvent = (typeof OUTBOUND_WEBHOOK_EVENTS)[number];

/**
 * Documento de endpoint webhook outbound configurado por organização.
 */
export interface IWebhookEndpoint extends Document {
  organizationId: Types.ObjectId;
  name: string;
  url: string;
  secret: string;
  events: OutboundWebhookEvent[];
  isActive: boolean;
  failureCount: number;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const webhookEndpointSchema = new Schema<IWebhookEndpoint>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    url: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (value: string): boolean => value.startsWith('https://'),
        message: 'URL do webhook deve usar HTTPS',
      },
    },
    secret: { type: String, required: true, trim: true, minlength: 16 },
    events: [{ type: String, required: true, enum: OUTBOUND_WEBHOOK_EVENTS }],
    isActive: { type: Boolean, required: true, default: true, index: true },
    failureCount: { type: Number, required: true, default: 0, min: 0 },
    lastSuccessAt: { type: Date, required: false },
    lastFailureAt: { type: Date, required: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'PlatformUser', required: true },
  },
  { timestamps: true },
);

webhookEndpointSchema.index({ organizationId: 1, isActive: 1, createdAt: -1 });
webhookEndpointSchema.index({ organizationId: 1, events: 1, isActive: 1 });

/** Model Mongoose para collection webhook_endpoints. */
export const WebhookEndpointModel = model<IWebhookEndpoint>('WebhookEndpoint', webhookEndpointSchema);
