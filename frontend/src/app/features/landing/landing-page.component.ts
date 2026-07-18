import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaqSectionComponent } from './faq-section/faq-section.component';
import { HeroLiveMockComponent } from './hero-live-mock/hero-live-mock.component';
import { HowItWorksSectionComponent } from './how-it-works-section/how-it-works-section.component';
import { PrivacySectionComponent } from './privacy-section/privacy-section.component';
import { PricingSectionComponent } from './pricing-section/pricing-section.component';
import { ProblemSectionComponent } from './problem-section/problem-section.component';

/**
 * Landing pública vendável: hero interativo, copy humanizado e planos da API.
 */
@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [
    RouterLink,
    HeroLiveMockComponent,
    ProblemSectionComponent,
    HowItWorksSectionComponent,
    PrivacySectionComponent,
    PricingSectionComponent,
    FaqSectionComponent,
  ],
  templateUrl: './landing-page.component.html',
})
export class LandingPageComponent {}
