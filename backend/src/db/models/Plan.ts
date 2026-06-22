import { Document, Schema, model } from 'mongoose';

/**
 * Intervalos de cobrança suportados para planos.
 */
export type BillingInterval = 'month' | 'year';

/**
 * Recursos habilitáveis por plano.
 */
export interface IPlanFeatures {
  gamification: boolean;
  ranking: boolean;
  exportCsv: boolean;
  exportPdf: boolean;
  apiAccess: boolean;
  webhooks: boolean;
  customChannelRules: boolean;
  teamGoals: boolean;
  advancedReports: boolean;
}

/**
 * Limites de uso aplicados por plano.
 */
export interface IPlanLimits {
  maxGuilds: number;
  maxTrackedMembers: number;
  dataRetentionDays: number;
}

/**
 * Documento de plano comercial do catálogo.
 */
export interface IPlan extends Document {
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  currency: 'BRL';
  billingInterval: BillingInterval;
  limits: IPlanLimits;
  features: IPlanFeatures;
  stripeProductId?: string;
  stripePriceId?: string;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  trialDays: number;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    description: { type: String, required: true, trim: true },
    priceCents: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, enum: ['BRL'], uppercase: true, default: 'BRL' },
    billingInterval: { type: String, required: true, enum: ['month', 'year'], default: 'month' },
    limits: {
      maxGuilds: { type: Number, required: true, min: 1 },
      maxTrackedMembers: { type: Number, required: true, min: 1 },
      dataRetentionDays: { type: Number, required: true, min: 1 },
    },
    features: {
      gamification: { type: Boolean, required: true, default: false },
      ranking: { type: Boolean, required: true, default: false },
      exportCsv: { type: Boolean, required: true, default: false },
      exportPdf: { type: Boolean, required: true, default: false },
      apiAccess: { type: Boolean, required: true, default: false },
      webhooks: { type: Boolean, required: true, default: false },
      customChannelRules: { type: Boolean, required: true, default: true },
      teamGoals: { type: Boolean, required: true, default: false },
      advancedReports: { type: Boolean, required: true, default: false },
    },
    stripeProductId: { type: String, required: false, trim: true },
    stripePriceId: { type: String, required: false, trim: true },
    isActive: { type: Boolean, required: true, default: true },
    isPublic: { type: Boolean, required: true, default: true },
    sortOrder: { type: Number, required: true, default: 0 },
    trialDays: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

planSchema.index({ slug: 1 }, { unique: true });
planSchema.index({ isPublic: 1, isActive: 1, sortOrder: 1 });

/** Model Mongoose para collection plans. */
export const PlanModel = model<IPlan>('Plan', planSchema);
