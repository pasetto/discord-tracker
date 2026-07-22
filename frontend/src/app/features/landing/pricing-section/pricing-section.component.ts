import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  FALLBACK_PRICING_PLANS,
  PricingPlanCardView,
  PublicPricingService,
} from '../../../core/pricing/public-pricing.service';

/**
 * Seção de preços da landing com planos em BRL carregados da API pública.
 */
@Component({
  selector: 'app-pricing-section',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './pricing-section.component.html',
})
export class PricingSectionComponent implements OnInit {
  loading = true;
  /** True quando a API pública falhou e o fallback local está em uso. */
  loadFailed = false;
  plans: PricingPlanCardView[] = FALLBACK_PRICING_PLANS;

  constructor(private readonly publicPricingService: PublicPricingService) {}

  /**
   * Carrega planos públicos ao inicializar a seção.
   * @returns void
   */
  ngOnInit(): void {
    this.publicPricingService.fetchPricingCards().subscribe({
      next: (plans) => {
        this.plans = plans;
        this.loadFailed = false;
        this.loading = false;
      },
      error: () => {
        this.plans = FALLBACK_PRICING_PLANS;
        this.loadFailed = true;
        this.loading = false;
      },
    });
  }
}
