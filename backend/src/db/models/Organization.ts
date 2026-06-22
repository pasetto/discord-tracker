import { Document, Schema, Types, model } from 'mongoose';

/**
 * Snapshot simples do plano para preservar histórico em grandfathering.
 */
export interface IPlanSnapshot {
  planId: Types.ObjectId;
  name: string;
  slug: string;
  priceCents: number;
  currency: string;
  billingInterval: 'month' | 'year';
}

/**
 * Dados de assinatura Stripe da organização.
 */
export interface IOrganizationSubscription {
  planId: Types.ObjectId;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  currentPeriodEnd: Date;
  trialEndsAt?: Date;
  grandfatheredPlanSnapshot?: IPlanSnapshot;
}

/**
 * Configurações globais por organização (tenant).
 */
export interface IOrganizationSettings {
  timezone: string;
  privacyPolicyAcceptedAt?: Date;
  memberConsentBannerEnabled: boolean;
}

/**
 * Documento de organização (tenant) da plataforma.
 */
export interface IOrganization extends Document {
  name: string;
  slug: string;
  subscription: IOrganizationSubscription;
  settings: IOrganizationSettings;
  createdAt: Date;
  updatedAt: Date;
}

const planSnapshotSchema = new Schema<IPlanSnapshot>(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    priceCents: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, trim: true, uppercase: true },
    billingInterval: { type: String, enum: ['month', 'year'], required: true },
  },
  { _id: false },
);

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true, unique: true },
    subscription: {
      planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
      stripeCustomerId: { type: String, required: true, trim: true },
      stripeSubscriptionId: { type: String, required: true, trim: true },
      status: {
        type: String,
        enum: ['trialing', 'active', 'past_due', 'canceled', 'unpaid'],
        required: true,
      },
      currentPeriodEnd: { type: Date, required: true },
      trialEndsAt: { type: Date, required: false },
      grandfatheredPlanSnapshot: { type: planSnapshotSchema, required: false },
    },
    settings: {
      timezone: { type: String, required: true, default: 'America/Sao_Paulo' },
      privacyPolicyAcceptedAt: { type: Date, required: false },
      memberConsentBannerEnabled: { type: Boolean, required: true, default: true },
    },
  },
  { timestamps: true },
);

organizationSchema.index({ slug: 1 }, { unique: true });

/** Model Mongoose para collection organizations. */
export const OrganizationModel = model<IOrganization>('Organization', organizationSchema);
