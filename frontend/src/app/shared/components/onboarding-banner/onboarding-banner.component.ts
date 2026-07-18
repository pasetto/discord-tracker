import { AsyncPipe, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map, Observable } from 'rxjs';
import { OnboardingProgress } from '../../../core/onboarding/onboarding-progress.model';
import { OnboardingProgressService } from '../../../core/onboarding/onboarding-progress.service';
import {
  resolveOnboardingBannerCtaLabel,
  resolveOnboardingBannerMessage,
} from '../../../core/onboarding/onboarding-first-win.util';
import { AuthService } from '../../../core/auth/auth.service';

/**
 * Banner global que incentiva conclusão do setup (incluindo checklist pós first-win).
 */
@Component({
  selector: 'app-onboarding-banner',
  standalone: true,
  imports: [NgIf, AsyncPipe, RouterLink],
  templateUrl: './onboarding-banner.component.html',
})
export class OnboardingBannerComponent implements OnInit {
  /**
   * Quantidade de passos concluídos no formato textual "N/8".
   */
  readonly progressText$: Observable<string>;

  /**
   * Controla se o banner deve aparecer (até onboarding completo).
   */
  readonly showBanner$: Observable<boolean>;

  /**
   * Mensagem contextual do banner (setup mínimo vs checklist opcional).
   */
  readonly bannerMessage$: Observable<string>;

  /**
   * Label do CTA do banner conforme estágio.
   */
  readonly bannerCtaLabel$: Observable<string>;

  constructor(
    private readonly onboardingProgressService: OnboardingProgressService,
    private readonly authService: AuthService,
  ) {
    this.progressText$ = this.onboardingProgressService.progress$.pipe(
      map((progress) => `${progress.completedSteps.length}/8`),
    );
    this.showBanner$ = this.onboardingProgressService.progress$.pipe(
      map((progress) => this.onboardingProgressService.shouldShowOnboardingBanner(progress)),
    );
    this.bannerMessage$ = this.onboardingProgressService.progress$.pipe(
      map((progress: OnboardingProgress) => resolveOnboardingBannerMessage(progress)),
    );
    this.bannerCtaLabel$ = this.onboardingProgressService.progress$.pipe(
      map((progress: OnboardingProgress) => resolveOnboardingBannerCtaLabel(progress)),
    );
  }

  /**
   * Carrega progresso inicial para renderizar banner corretamente.
   * @returns {void} Não retorna valor
   */
  ngOnInit(): void {
    this.onboardingProgressService.load(this.authService.getOrganizationId()).subscribe();
  }
}
