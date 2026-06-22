import { Document, Schema, Types, model } from 'mongoose';

/**
 * Chaves criptográficas da assinatura Web Push no navegador.
 */
export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

/**
 * Documento de assinatura Web Push por usuário/organização.
 */
export interface IPushSubscription extends Document {
  organizationId: Types.ObjectId;
  userId: Types.ObjectId;
  endpoint: string;
  keys: PushSubscriptionKeys;
  expirationTime?: number | null;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const pushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'PlatformUser', required: true, index: true },
    endpoint: { type: String, required: true, trim: true },
    keys: {
      p256dh: { type: String, required: true, trim: true },
      auth: { type: String, required: true, trim: true },
    },
    expirationTime: { type: Number, required: false, default: null },
    userAgent: { type: String, required: false, trim: true },
  },
  { timestamps: true },
);

pushSubscriptionSchema.index({ organizationId: 1, userId: 1, endpoint: 1 }, { unique: true });
pushSubscriptionSchema.index({ organizationId: 1, endpoint: 1 }, { unique: true });

/** Model Mongoose para collection push_subscriptions. */
export const PushSubscriptionModel = model<IPushSubscription>('PushSubscription', pushSubscriptionSchema);
