import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Representa um card de plano exibido na landing page.
 */
export interface PricingPlanCard {
  name: 'Starter' | 'Team';
  priceBrlMonthly: string;
  description: string;
  maxTrackedMembers: number;
}

/**
 * Seção de preços da landing com planos em BRL.
 */
@Component({
  selector: 'app-pricing-section',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './pricing-section.component.html',
})
export class PricingSectionComponent {
  /**
   * Cards de preço visíveis publicamente na landing.
   */
  readonly plans: PricingPlanCard[] = [
    {
      name: 'Starter',
      priceBrlMonthly: 'R$ 79',
      description: 'Para times enxutos que precisam descobrir rapidamente quem sumiu.',
      maxTrackedMembers: 25,
    },
    {
      name: 'Team',
      priceBrlMonthly: 'R$ 149',
      description: 'Para equipes em crescimento que querem colaboração mais previsível.',
      maxTrackedMembers: 75,
    },
  ];
}
