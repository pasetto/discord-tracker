import { AsyncPipe, NgClass, NgFor, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { OnboardingProgress } from '../../core/onboarding/onboarding-progress.model';
import { OnboardingProgressService } from '../../core/onboarding/onboarding-progress.service';

/**
 * Metadados de apresentação para cada etapa do onboarding.
 */
interface OnboardingStepMeta {
  step: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  title: string;
  description: string;
  actionLabel?: string;
  actionRoute?: string;
}

/**
 * Wizard simplificado de onboarding com 8 passos visíveis e navegação.
 */
@Component({
  selector: 'app-onboarding-wizard',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, AsyncPipe, RouterLink],
  templateUrl: './onboarding-wizard.component.html',
})
export class OnboardingWizardComponent implements OnInit {
  /**
   * Define dados visuais e links de apoio para cada passo.
   */
  readonly steps: OnboardingStepMeta[] = [
    { step: 1, title: 'Conta criada', description: 'Sua organização foi criada e já pode iniciar o setup.' },
    { step: 2, title: 'Conectar bot Discord', description: 'Conecte o bot ao aplicativo Discord da organização.', actionLabel: 'Configurar bot', actionRoute: '/app/settings' },
    { step: 3, title: 'Escolher servidor', description: 'Selecione o servidor (guild) que será monitorado.', actionLabel: 'Configurações', actionRoute: '/app/settings' },
    { step: 4, title: 'Configurar canais', description: 'Defina canais de voz/texto colaborativos e exceções.', actionLabel: 'Abrir canais', actionRoute: '/app/settings/channels' },
    { step: 5, title: 'Calendário de trabalho', description: 'Aplique jornada padrão BR e revise os feriados.', actionLabel: 'Abrir calendário', actionRoute: '/app/settings/calendar' },
    { step: 6, title: 'Categorias do time', description: 'Organize membros por categorias como Dev e Suporte.', actionLabel: 'Abrir metas', actionRoute: '/app/settings/goals' },
    { step: 7, title: 'Atribuir membros', description: 'Atribua categorias para os membros rastreados do servidor.' },
    { step: 8, title: 'Pronto', description: 'Finalize o onboarding e continue no dashboard.' },
  ];

  /**
   * Stream de progresso utilizado pela tela.
   */
  readonly progress$: Observable<OnboardingProgress>;

  private orgId = '';

  constructor(private readonly onboardingProgressService: OnboardingProgressService) {
    this.progress$ = this.onboardingProgressService.progress$;
  }

  /**
   * Carrega estado inicial de onboarding para a organização ativa.
   * @returns {void} Não retorna valor
   */
  ngOnInit(): void {
    this.orgId = localStorage.getItem('syntra.orgId') ?? '';
    this.onboardingProgressService.load(this.orgId).subscribe();
  }

  /**
   * Navega para o passo imediatamente anterior quando possível.
   * @returns {void} Não retorna valor
   */
  goPrevious(): void {
    const current = this.onboardingProgressService.currentProgress.currentStep;
    const previous = Math.max(1, current - 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    this.onboardingProgressService.save(this.orgId, { currentStep: previous }).subscribe();
  }

  /**
   * Navega para o próximo passo e marca o atual como concluído.
   * @returns {void} Não retorna valor
   */
  goNext(): void {
    const current = this.onboardingProgressService.currentProgress.currentStep;
    const next = Math.min(8, current + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    this.persistStepProgress(current, next);
  }

  /**
   * Salta diretamente para um passo específico da lista.
   * @param step Passo alvo selecionado pelo usuário
   * @returns {void} Não retorna valor
   */
  jumpToStep(step: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8): void {
    const current = this.onboardingProgressService.currentProgress.currentStep;
    this.persistStepProgress(current, step);
  }

  /**
   * Finaliza onboarding e registra etapa 8 como concluída.
   * @returns {void} Não retorna valor
   */
  completeOnboarding(): void {
    const current = this.onboardingProgressService.currentProgress;
    const completedSteps = Array.from(new Set([...current.completedSteps, 8])).sort((a, b) => a - b);
    this.onboardingProgressService
      .save(this.orgId, {
        currentStep: 8,
        completedSteps,
        completedAt: new Date().toISOString(),
      })
      .subscribe();
  }

  /**
   * Informa se o passo já está concluído no progresso atual.
   * @param progress Progresso atual de onboarding
   * @param step Passo avaliado
   * @returns true quando o passo está concluído
   */
  isStepCompleted(progress: OnboardingProgress, step: number): boolean {
    return progress.completedSteps.includes(step);
  }

  /**
   * Persiste avanço de passo e flags derivadas (canais/calendário/etc).
   * @param currentStep Passo atual antes da navegação
   * @param nextStep Passo alvo após navegação
   * @returns {void} Não retorna valor
   */
  private persistStepProgress(
    currentStep: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
    nextStep: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
  ): void {
    const current = this.onboardingProgressService.currentProgress;
    const completedSteps = Array.from(new Set([...current.completedSteps, currentStep])).sort((a, b) => a - b);

    this.onboardingProgressService
      .save(this.orgId, {
        currentStep: nextStep,
        completedSteps,
        botConnected: completedSteps.includes(2),
        guildSelected: completedSteps.includes(3),
        channelsConfigured: completedSteps.includes(4),
        calendarConfigured: completedSteps.includes(5),
        categoriesConfigured: completedSteps.includes(6),
        membersAssigned: completedSteps.includes(7),
      })
      .subscribe();
  }
}

