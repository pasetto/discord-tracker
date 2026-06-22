import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PricingSectionComponent } from './pricing-section/pricing-section.component';

/**
 * Landing pública minimalista para entrada no fluxo de aquisição.
 */
@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink, PricingSectionComponent],
  templateUrl: './landing-page.component.html',
})
export class LandingPageComponent {}
