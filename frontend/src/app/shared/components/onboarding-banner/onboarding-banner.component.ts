import { AsyncPipe, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map, Observable } from 'rxjs';
import { OnboardingProgressService } from '../../../core/onboarding/onboarding-progress.service';

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

  constructor(private readonly onboardingProgressService: OnboardingProgressService) {
    this.progressText$ = this.onboardingProgressService.progress$.pipe(
      map((progress) => `${progress.completedSteps.length}/8`),
    );
    this.showBanner$ = this.onboardingProgressService.progress$.pipe(
      map((progress) => !(progress.channelsConfigured && progress.calendarConfigured)),
    );
  }

  /**
   * Carrega progresso inicial para renderizar banner corretamente.
   * @returns {void} Não retorna valor
   */
  ngOnInit(): void {
    const orgId = localStorage.getItem('syntra.orgId') ?? '';
    this.onboardingProgressService.load(orgId).subscribe();
  }
}

