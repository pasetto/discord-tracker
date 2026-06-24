import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  FALLBACK_PRICING_PLANS,
  PublicPricingService,
  formatBrlMonthly,
  toPricingPlanCard,
} from './public-pricing.service';

describe('PublicPricingService', () => {
  let service: PublicPricingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PublicPricingService],
    });
    service = TestBed.inject(PublicPricingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('formata preço BRL a partir de centavos', () => {
    expect(formatBrlMonthly(29900)).toBe('R$ 299');
    expect(formatBrlMonthly(7900)).toBe('R$ 79');
  });

  it('mapeia plano Business com highlights de API e webhooks', () => {
    const card = toPricingPlanCard({
      slug: 'business',
      name: 'Business',
      description: 'Escala',
      priceCents: 29900,
      currency: 'BRL',
      billingInterval: 'month',
      limits: { maxGuilds: 3, maxTrackedMembers: 200, dataRetentionDays: 365 },
      features: { exportCsv: true, apiAccess: true, webhooks: true },
      trialDays: 7,
      sortOrder: 3,
    });

    expect(card.highlights).toContain('Webhooks de integração');
    expect(card.highlights).toContain('Até 3 servidores Discord');
  });

  it('usa fallback quando API falha', () => {
    let result = FALLBACK_PRICING_PLANS;

    service.fetchPricingCards().subscribe((plans) => {
      result = plans;
    });

    const request = httpMock.expectOne('/api/v1/pricing');
    request.error(new ProgressEvent('error'));

    expect(result).toEqual(FALLBACK_PRICING_PLANS);
  });
});
