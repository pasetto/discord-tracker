import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaqSectionComponent } from './faq-section/faq-section.component';
import { HeroLiveMockComponent } from './hero-live-mock/hero-live-mock.component';
import { HowItWorksSectionComponent } from './how-it-works-section/how-it-works-section.component';
import { PrivacySectionComponent } from './privacy-section/privacy-section.component';
import { PricingSectionComponent } from './pricing-section/pricing-section.component';
import { ProblemSectionComponent } from './problem-section/problem-section.component';
import {
  applyMotionReadyClass,
  loadAnimeMotionApi,
  observeScrollReveals,
  playHeroEntrance,
} from './motion/landing-motion';
import { prefersReducedMotion } from './motion/prefers-reduced-motion';

/**
 * Landing pública vendável: hero interativo, copy humanizado e planos da API.
 * Motion (anime.js) é lazy-loaded só nesta rota; respeita prefers-reduced-motion.
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
  styles: [
    `
      .landing-root {
        --motion-duration-instant: 120ms;
        --motion-duration-fast: 180ms;
        --motion-duration-enter: 280ms;
        --motion-duration-layout: 360ms;
        --motion-duration-hero: 420ms;
        --motion-ease-out: cubic-bezier(0.25, 1, 0.5, 1);
        --motion-ease-out-soft: cubic-bezier(0.22, 1, 0.36, 1);
        --motion-ease-exit: cubic-bezier(0.4, 0, 1, 1);
        --motion-y-enter: 12px;
        --motion-y-mock: 8px;
        --motion-y-card: 16px;
        --motion-stagger-tight: 40ms;
        --motion-stagger-base: 60ms;
        --motion-stagger-cards: 80ms;
        --motion-hover-lift: 2px;
        --motion-hover-scale: 1.01;
        --motion-sumiu-pulse-ms: 900ms;
        --motion-sumiu-pulse-scale: 1.04;
      }

      .landing-root.has-motion [data-motion='hero-brand'],
      .landing-root.has-motion [data-motion='hero-headline'],
      .landing-root.has-motion [data-motion='hero-sub'],
      .landing-root.has-motion [data-motion='hero-ctas'],
      .landing-root.has-motion [data-motion='hero-trust'],
      .landing-root.has-motion [data-testid='landing-hero-mock'],
      .landing-root.has-motion [data-motion='mock-chrome'],
      .landing-root.has-motion [data-testid='landing-hero-mock-members'] li,
      .landing-root.has-motion [data-motion='reveal-heading'],
      .landing-root.has-motion [data-motion='reveal-lead'],
      .landing-root.has-motion [data-motion='reveal-child'],
      .landing-root.has-motion [data-motion='reveal-shell'] {
        opacity: 0;
      }

      .landing-root.has-motion [data-motion='reveal-child'],
      .landing-root [data-hover='card'] {
        transition:
          transform var(--motion-duration-fast) var(--motion-ease-out),
          border-color var(--motion-duration-fast) var(--motion-ease-out);
      }

      .landing-root [data-hover='card']:hover {
        transform: translateY(calc(var(--motion-hover-lift) * -1));
      }

      .landing-cta-primary {
        transition: background-color var(--motion-duration-fast) var(--motion-ease-out);
      }

      @media (prefers-reduced-motion: reduce) {
        .landing-root,
        .landing-root * {
          transition: none !important;
          animation: none !important;
        }

        .landing-root.has-motion [data-motion='hero-brand'],
        .landing-root.has-motion [data-motion='hero-headline'],
        .landing-root.has-motion [data-motion='hero-sub'],
        .landing-root.has-motion [data-motion='hero-ctas'],
        .landing-root.has-motion [data-motion='hero-trust'],
        .landing-root.has-motion [data-testid='landing-hero-mock'],
        .landing-root.has-motion [data-motion='mock-chrome'],
        .landing-root.has-motion [data-testid='landing-hero-mock-members'] li,
        .landing-root.has-motion [data-motion='reveal-heading'],
        .landing-root.has-motion [data-motion='reveal-lead'],
        .landing-root.has-motion [data-motion='reveal-child'],
        .landing-root.has-motion [data-motion='reveal-shell'] {
          opacity: 1 !important;
          transform: none !important;
        }

        .landing-root [data-hover='card']:hover {
          transform: none;
        }
      }
    `,
  ],
})
export class LandingPageComponent implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private cleanupReveals: (() => void) | null = null;
  private cancelHero: (() => void) | null = null;
  private destroyed = false;

  /**
   * Boot do motion system após o primeiro paint (lazy anime.js).
   * @returns Promise void
   */
  async ngAfterViewInit(): Promise<void> {
    const root = this.host.nativeElement.querySelector('.landing-root') ?? this.host.nativeElement;
    const reduced = prefersReducedMotion();

    if (reduced) {
      applyMotionReadyClass(root, false);
      return;
    }

    applyMotionReadyClass(root, true);

    try {
      const anime = await loadAnimeMotionApi();
      if (this.destroyed) {
        return;
      }

      const heroHandle = playHeroEntrance({ root, reducedMotion: false, anime });
      this.cancelHero = heroHandle?.cancel ?? null;
      this.cleanupReveals = observeScrollReveals(root, { reducedMotion: false, anime });
    } catch {
      applyMotionReadyClass(root, false);
    }
  }

  /** Cancela timelines e observers ao sair da rota. */
  ngOnDestroy(): void {
    this.destroyed = true;
    this.cancelHero?.();
    this.cleanupReveals?.();
  }
}
