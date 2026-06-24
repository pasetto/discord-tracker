import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

/**
 * Features de plano expostas na API pública de pricing.
 */
export interface PublicPlanFeaturesDto {
  gamification?: boolean;
  ranking?: boolean;
  exportCsv?: boolean;
  exportPdf?: boolean;
  apiAccess?: boolean;
  webhooks?: boolean;
  customChannelRules?: boolean;
  teamGoals?: boolean;
  advancedReports?: boolean;
}

/**
 * Limites de plano expostos na API pública.
 */
export interface PublicPlanLimitsDto {
  maxGuilds: number;
  maxTrackedMembers: number;
  dataRetentionDays: number;
}

/**
 * Plano público retornado por GET /api/v1/pricing.
 */
export interface PublicPlanDto {
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  currency: 'BRL';
  billingInterval: 'month' | 'year';
  limits: PublicPlanLimitsDto;
  features: PublicPlanFeaturesDto;
  trialDays: number;
  sortOrder: number;
}

/**
 * Card de plano formatado para a landing page.
 */
export interface PricingPlanCardView {
  slug: string;
  name: string;
  priceBrlMonthly: string;
  description: string;
  maxTrackedMembers: number;
  highlights: string[];
  featured: boolean;
}

/** Planos fallback quando a API de pricing não está disponível. */
export const FALLBACK_PRICING_PLANS: PricingPlanCardView[] = [
  {
    slug: 'starter',
    name: 'Starter',
    priceBrlMonthly: 'R$ 79',
    description: 'Para times enxutos que precisam descobrir rapidamente quem sumiu.',
    maxTrackedMembers: 25,
    highlights: ['Alertas de inatividade', 'Calendário + PTO'],
    featured: false,
  },
  {
    slug: 'team',
    name: 'Team',
    priceBrlMonthly: 'R$ 149',
    description: 'Para equipes em crescimento que querem colaboração mais previsível.',
    maxTrackedMembers: 75,
    highlights: ['Ranking e gamificação', 'Export CSV'],
    featured: true,
  },
  {
    slug: 'business',
    name: 'Business',
    priceBrlMonthly: 'R$ 299',
    description: 'Para operações maiores com exportação, API e webhooks.',
    maxTrackedMembers: 200,
    highlights: ['API + webhooks', 'Até 3 servidores Discord'],
    featured: false,
  },
];

/**
 * Formata centavos BRL para exibição mensal na landing.
 * @param priceCents Valor em centavos
 * @returns Texto no formato R$ XX
 */
export function formatBrlMonthly(priceCents: number): string {
  const value = priceCents / 100;
  return value % 1 === 0 ? `R$ ${value.toFixed(0)}` : `R$ ${value.toFixed(2).replace('.', ',')}`;
}

/**
 * Monta bullets de destaque a partir das features do plano.
 * @param plan Plano da API pública
 * @returns Lista curta de benefícios para o card
 */
export function buildPlanHighlights(plan: PublicPlanDto): string[] {
  const highlights: string[] = [];

  if (plan.limits.maxGuilds > 1) {
    highlights.push(`Até ${plan.limits.maxGuilds} servidores Discord`);
  }
  if (plan.features.apiAccess) {
    highlights.push('Acesso à API');
  }
  if (plan.features.webhooks) {
    highlights.push('Webhooks de integração');
  }
  if (plan.features.ranking) {
    highlights.push('Ranking configurável');
  }
  if (plan.features.exportCsv) {
    highlights.push('Export CSV');
  }
  if (highlights.length === 0) {
    highlights.push('Alertas de quem sumiu', 'Metadados sem invasão');
  }

  return highlights.slice(0, 3);
}

/**
 * Converte DTO da API em card da landing.
 * @param plan Plano público
 * @returns Card formatado para template
 */
export function toPricingPlanCard(plan: PublicPlanDto): PricingPlanCardView {
  return {
    slug: plan.slug,
    name: plan.name,
    priceBrlMonthly: formatBrlMonthly(plan.priceCents),
    description: plan.description,
    maxTrackedMembers: plan.limits.maxTrackedMembers,
    highlights: buildPlanHighlights(plan),
    featured: plan.slug === 'team',
  };
}

/**
 * Serviço para carregar planos públicos da landing via API.
 */
@Injectable({ providedIn: 'root' })
export class PublicPricingService {
  constructor(private readonly http: HttpClient) {}

  /**
   * Busca planos ativos para exibição na landing.
   * @returns Observable com cards prontos para UI; fallback local em erro de rede
   */
  fetchPricingCards(): Observable<PricingPlanCardView[]> {
    return this.http.get<{ plans: PublicPlanDto[] }>('/api/v1/pricing').pipe(
      map((response) => {
        if (!response.plans?.length) {
          return FALLBACK_PRICING_PLANS;
        }
        return response.plans.map(toPricingPlanCard);
      }),
      catchError(() => of(FALLBACK_PRICING_PLANS)),
    );
  }
}
