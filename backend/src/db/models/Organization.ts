import { randomInt } from 'node:crypto';
import { Document, Schema, Types, model } from 'mongoose';

/** Alfabeto sem caracteres ambíguos para códigos de convite. */
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Gera código de convite de 8 caracteres.
 * @returns Código em maiúsculas
 */
function generateInviteCode(): string {
  let code = '';
  for (let index = 0; index < 8; index += 1) {
    code += INVITE_CODE_ALPHABET[randomInt(0, INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

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
  viewerCanSeeIndividualReports: boolean;
}

/**
 * Código de convite de 8 caracteres para entrada na organização.
 */
export type OrganizationInviteCode = string;

/**
 * Progresso do onboarding em 8 etapas da organização.
 */
export interface IOnboardingProgress {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  completedSteps: number[];
  botConnected: boolean;
  guildSelected: boolean;
  channelsConfigured: boolean;
  calendarConfigured: boolean;
  categoriesConfigured: boolean;
  membersAssigned: boolean;
  completedAt?: Date;
}

/**
 * Documento de organização (tenant) da plataforma.
 */
export interface IOrganization extends Document {
  name: string;
  slug: string;
  inviteCode: OrganizationInviteCode;
  subscription: IOrganizationSubscription;
  settings: IOrganizationSettings;
  onboarding: IOnboardingProgress;
  createdAt: Date;
  updatedAt: Date;
}

const onboardingProgressSchema = new Schema<IOnboardingProgress>(
  {
    currentStep: { type: Number, required: true, min: 1, max: 8, default: 1 },
    completedSteps: { type: [Number], required: true, default: [1] },
    botConnected: { type: Boolean, required: true, default: false },
    guildSelected: { type: Boolean, required: true, default: false },
    channelsConfigured: { type: Boolean, required: true, default: false },
    calendarConfigured: { type: Boolean, required: true, default: false },
    categoriesConfigured: { type: Boolean, required: true, default: false },
    membersAssigned: { type: Boolean, required: true, default: false },
    completedAt: { type: Date, required: false },
  },
  { _id: false },
);

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
    inviteCode: { type: String, required: true, trim: true, uppercase: true, unique: true, minlength: 8, maxlength: 8 },
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
      viewerCanSeeIndividualReports: { type: Boolean, required: true, default: false },
    },
    onboarding: { type: onboardingProgressSchema, required: true, default: () => ({}) },
  },
  { timestamps: true },
);

organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ inviteCode: 1 }, { unique: true });

/**
 * Gera `inviteCode` automaticamente quando ausente (compatível com dados e testes legados).
 */
organizationSchema.pre('validate', async function assignInviteCodeWhenMissing() {
  if (this.inviteCode) {
    return;
  }

  const Organization = this.constructor as typeof OrganizationModel;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = generateInviteCode();
    const exists = await Organization.exists({ inviteCode: candidate }).exec();
    if (!exists) {
      this.inviteCode = candidate;
      return;
    }
  }

  throw new Error('Não foi possível gerar código de convite único');
});

/** Model Mongoose para collection organizations. */
export const OrganizationModel = model<IOrganization>('Organization', organizationSchema);
