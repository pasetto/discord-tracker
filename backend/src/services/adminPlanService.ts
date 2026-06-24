import { Types } from 'mongoose';
import { PlanModel, type BillingInterval, type IPlan, type IPlanFeatures, type IPlanLimits } from '../db/models/Plan';

/** DTO público de plano para painel admin (sem segredos Stripe em escrita). */
export interface AdminPlanDto {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

/** Payload para criar ou atualizar plano via admin. */
export interface UpsertAdminPlanInput {
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  billingInterval: BillingInterval;
  limits: IPlanLimits;
  features: IPlanFeatures;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  trialDays: number;
  stripeProductId?: string;
  stripePriceId?: string;
}

/**
 * Converte documento Mongoose em DTO admin.
 * @param plan Documento do plano
 * @returns Representação serializada para API
 */
export function toAdminPlanDto(plan: IPlan): AdminPlanDto {
  return {
    id: String(plan._id),
    name: plan.name,
    slug: plan.slug,
    description: plan.description,
    priceCents: plan.priceCents,
    currency: plan.currency,
    billingInterval: plan.billingInterval,
    limits: plan.limits,
    features: plan.features,
    stripeProductId: plan.stripeProductId,
    stripePriceId: plan.stripePriceId,
    isActive: plan.isActive,
    isPublic: plan.isPublic,
    sortOrder: plan.sortOrder,
    trialDays: plan.trialDays,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

/**
 * Lista todos os planos do catálogo (inclui inativos).
 * @returns Planos ordenados por `sortOrder`
 */
export async function listAdminPlans(): Promise<AdminPlanDto[]> {
  const plans = await PlanModel.find({}).sort({ sortOrder: 1, name: 1 }).exec();
  return plans.map(toAdminPlanDto);
}

/**
 * Busca plano por ID.
 * @param planId Identificador do plano
 * @returns DTO ou null
 */
export async function getAdminPlanById(planId: string): Promise<AdminPlanDto | null> {
  if (!Types.ObjectId.isValid(planId)) {
    return null;
  }

  const plan = await PlanModel.findById(planId).exec();
  return plan ? toAdminPlanDto(plan) : null;
}

/**
 * Normaliza slug de plano.
 * @param slug Texto informado
 * @returns Slug URL-safe em minúsculas
 */
function normalizePlanSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Valida payload de upsert de plano.
 * @param input Dados do formulário admin
 */
function assertPlanInput(input: UpsertAdminPlanInput): void {
  if (!input.name?.trim()) {
    throw new Error('Informe o nome do plano');
  }
  if (!input.slug?.trim()) {
    throw new Error('Informe o slug do plano');
  }
  if (!Number.isFinite(input.priceCents) || input.priceCents < 0) {
    throw new Error('Preço inválido');
  }
  if (!input.limits?.maxGuilds || input.limits.maxGuilds < 1) {
    throw new Error('maxGuilds deve ser >= 1');
  }
  if (!input.limits?.maxTrackedMembers || input.limits.maxTrackedMembers < 1) {
    throw new Error('maxTrackedMembers deve ser >= 1');
  }
}

/**
 * Cria novo plano no catálogo.
 * @param input Dados do plano
 * @returns Plano criado
 */
export async function createAdminPlan(input: UpsertAdminPlanInput): Promise<AdminPlanDto> {
  assertPlanInput(input);
  const slug = normalizePlanSlug(input.slug);

  const existing = await PlanModel.findOne({ slug }).exec();
  if (existing) {
    throw new Error('Já existe um plano com este slug');
  }

  const plan = await PlanModel.create({
    ...input,
    slug,
    currency: 'BRL',
  });

  return toAdminPlanDto(plan);
}

/**
 * Atualiza plano existente.
 * @param planId Identificador do plano
 * @param input Campos a atualizar
 * @returns Plano atualizado ou null
 */
export async function updateAdminPlan(planId: string, input: Partial<UpsertAdminPlanInput>): Promise<AdminPlanDto | null> {
  if (!Types.ObjectId.isValid(planId)) {
    return null;
  }

  const update: Record<string, unknown> = { ...input };
  if (input.slug) {
    update.slug = normalizePlanSlug(input.slug);
  }

  const plan = await PlanModel.findByIdAndUpdate(planId, { $set: update }, { new: true, runValidators: true }).exec();
  return plan ? toAdminPlanDto(plan) : null;
}
