import { Types } from 'mongoose';
import Stripe from 'stripe';
import { OrganizationModel } from '../db/models/Organization';
import { PlanModel, type IPlan } from '../db/models/Plan';

/**
 * Payload para criação de checkout session.
 */
export interface CreateCheckoutSessionInput {
  organizationId: string;
  planSlug: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

/**
 * Resultado da criação de checkout session.
 */
export interface CreateCheckoutSessionResult {
  sessionId: string;
  checkoutUrl: string | null;
  mode: 'live' | 'mock';
}

/**
 * Dados necessários para validar limite de membros rastreados.
 */
export interface EnforceMaxTrackedMembersInput {
  currentTrackedMembers: number;
  maxTrackedMembers: number;
}

/**
 * Erro de negócio para excesso de limites do plano.
 */
export class BillingLimitError extends Error {
  limit: number;
  current: number;

  /**
   * Cria erro semântico de limite de billing.
   * @param {number} current Quantidade atual em uso
   * @param {number} limit Limite permitido pelo plano
   * @returns {void} Não retorna valor
   */
  constructor(current: number, limit: number) {
    super(`Limite de membros rastreados excedido (${current}/${limit})`);
    this.name = 'BillingLimitError';
    this.limit = limit;
    this.current = current;
  }
}

/**
 * Assinatura mínima da API Stripe usada pelo serviço.
 */
interface StripeGateway {
  checkout: {
    sessions: {
      create(params: Stripe.Checkout.SessionCreateParams): Promise<{
        id: string;
        url: string | null;
      }>;
    };
  };
}

/**
 * Cria cliente Stripe real ou mock local para testes sem secret key.
 * @returns {{ gateway: StripeGateway; mode: 'live' | 'mock' }} Gateway Stripe e modo de operação
 */
function createStripeGateway(): { gateway: StripeGateway; mode: 'live' | 'mock' } {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    const mockGateway: StripeGateway = {
      checkout: {
        sessions: {
          create: async () => ({
            id: `cs_mock_${Date.now()}`,
            url: 'https://checkout.stripe.com/mock-session',
          }),
        },
      },
    };
    return { gateway: mockGateway, mode: 'mock' };
  }

  const stripe = new Stripe(secretKey);
  return { gateway: stripe, mode: 'live' };
}

/**
 * Converte string para ObjectId válido.
 * @param {string} value Valor textual recebido da API
 * @param {string} label Nome lógico para mensagem de erro
 * @returns {Types.ObjectId} ObjectId pronto para consultas
 * @throws {Error} Quando valor não for ObjectId válido
 */
function parseObjectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw new Error(`${label} inválido`);
  }
  return new Types.ObjectId(value);
}

/**
 * Representação pública de plano para landing e checkout.
 */
export interface PublicPlanDto {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  currency: 'BRL';
  billingInterval: IPlan['billingInterval'];
  limits: IPlan['limits'];
  features: IPlan['features'];
  trialDays: number;
  sortOrder: number;
}

/**
 * Converte documento de plano em DTO público (sem IDs Stripe).
 * @param plan Plano Mongoose
 * @returns Objeto serializável para API pública
 */
export function toPublicPlanDto(plan: IPlan): PublicPlanDto {
  return {
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    priceCents: plan.priceCents,
    currency: plan.currency,
    billingInterval: plan.billingInterval,
    limits: plan.limits,
    features: plan.features,
    trialDays: plan.trialDays,
    sortOrder: plan.sortOrder,
  };
}

/**
 * Lista planos públicos e ativos para exibição na landing.
 * @returns Planos ordenados por `sortOrder`
 */
export async function listPublicPlans(): Promise<PublicPlanDto[]> {
  const plans = await PlanModel.find({ isActive: true, isPublic: true })
    .sort({ sortOrder: 1, name: 1 })
    .exec();

  return plans.map(toPublicPlanDto);
}

/**
 * Busca plano público/ativo por slug para checkout.
 * @param {string} slug Slug do plano selecionado
 * @returns {Promise<IPlan>} Plano encontrado
 * @throws {Error} Quando plano não estiver disponível para compra
 */
export async function getPublicPlanBySlug(slug: string): Promise<IPlan> {
  const normalizedSlug = slug.trim().toLowerCase();
  const plan = await PlanModel.findOne({
    slug: normalizedSlug,
    isActive: true,
    isPublic: true,
  })
    .exec();

  if (!plan) {
    throw new Error('Plano indisponível para checkout');
  }

  return plan;
}

/**
 * Garante que o total atual de membros não viola o limite do plano.
 * @param {EnforceMaxTrackedMembersInput} input Quantidade atual e limite máximo permitido
 * @returns {void} Não retorna valor
 * @throws {BillingLimitError} Quando currentTrackedMembers for maior que o limite
 * @example
 * enforceMaxTrackedMembers({ currentTrackedMembers: 25, maxTrackedMembers: 25 });
 */
export function enforceMaxTrackedMembers(input: EnforceMaxTrackedMembersInput): void {
  if (input.currentTrackedMembers > input.maxTrackedMembers) {
    throw new BillingLimitError(input.currentTrackedMembers, input.maxTrackedMembers);
  }
}

/**
 * Cria uma Stripe Checkout Session para assinatura mensal em BRL.
 * @param {CreateCheckoutSessionInput} input Dados do tenant, plano e URLs de retorno
 * @returns {Promise<CreateCheckoutSessionResult>} Session criada com URL do checkout
 * @throws {Error} Quando orgId/plano estiverem inválidos
 */
export async function createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult> {
  const organizationId = parseObjectId(input.organizationId, 'organizationId');
  const plan = await getPublicPlanBySlug(input.planSlug);
  const { gateway, mode } = createStripeGateway();

  const stripePriceId = plan.stripePriceId;
  if (!stripePriceId && mode === 'live') {
    throw new Error('Plano sem stripePriceId configurado');
  }

  const session = await gateway.checkout.sessions.create({
    mode: 'subscription',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    currency: 'brl',
    customer_email: input.customerEmail,
    line_items: [
      stripePriceId
        ? {
            price: stripePriceId,
            quantity: 1,
          }
        : {
            price_data: {
              currency: 'brl',
              product_data: {
                name: plan.name,
                description: plan.description,
              },
              unit_amount: plan.priceCents,
              recurring: {
                interval: plan.billingInterval,
              },
            },
            quantity: 1,
          },
    ],
    metadata: {
      organizationId: organizationId.toHexString(),
      planSlug: plan.slug,
    },
  });

  return {
    sessionId: session.id,
    checkoutUrl: session.url,
    mode,
  };
}

/**
 * Ativa assinatura da organização ao receber checkout.session.completed.
 * @param {Stripe.Checkout.Session} session Sessão retornada no webhook Stripe
 * @returns {Promise<void>} Promise resolvida após persistir assinatura
 * @throws {Error} Quando metadata de organizationId/planSlug estiver ausente
 */
export async function activateSubscriptionFromCheckoutSession(session: Stripe.Checkout.Session): Promise<void> {
  const organizationId = session.metadata?.organizationId;
  const planSlug = session.metadata?.planSlug;
  if (!organizationId || !planSlug) {
    throw new Error('Metadata obrigatória ausente no checkout.session.completed');
  }

  const plan = await getPublicPlanBySlug(planSlug);
  const status = session.payment_status === 'paid' ? 'active' : 'trialing';
  const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await OrganizationModel.findByIdAndUpdate(
    parseObjectId(organizationId, 'organizationId'),
    {
      $set: {
        'subscription.planId': plan._id,
        'subscription.stripeCustomerId': session.customer?.toString() ?? '',
        'subscription.stripeSubscriptionId': session.subscription?.toString() ?? session.id,
        'subscription.status': status,
        'subscription.currentPeriodEnd': currentPeriodEnd,
      },
    },
    { new: false },
  ).exec();
}
