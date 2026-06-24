import { AsyncPipe, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map, Observable } from 'rxjs';
import { OnboardingProgressService } from '../../../core/onboarding/onboarding-progress.service';
import { AuthService } from '../../../core/auth/auth.service';

/**
 * Banner global que incentiva conclusão do setup mínimo do onboarding.
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
   * Controla se o banner deve aparecer (até setup mínimo).
   */
  readonly showBanner$: Observable<boolean>;

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
  }

  /**
   * Carrega progresso inicial para renderizar banner corretamente.
   * @returns {void} Não retorna valor
   */
  ngOnInit(): void {
    this.onboardingProgressService.load(this.authService.getOrganizationId()).subscribe();
  }
}

