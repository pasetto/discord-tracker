import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HowItWorksSectionComponent } from './how-it-works-section/how-it-works-section.component';
import { PrivacySectionComponent } from './privacy-section/privacy-section.component';
import { PricingSectionComponent } from './pricing-section/pricing-section.component';
import { ProblemSectionComponent } from './problem-section/problem-section.component';

/**
 * Landing pública minimalista para entrada no fluxo de aquisição.
 */
@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    RouterLink,
    ProblemSectionComponent,
    HowItWorksSectionComponent,
    PrivacySectionComponent,
    PricingSectionComponent,
  ],
  templateUrl: './landing-page.component.html',
})
export class LandingPageComponent {}
