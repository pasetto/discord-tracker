import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import {
  OnboardingProgress,
  canUseFirstWinShortcut,
  createInitialOnboardingProgress,
  hasDeferredOnboardingSteps,
} from './onboarding-progress.model';

/**
 * Serviço central para carregar e atualizar progresso do onboarding.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingProgressService {
  private readonly progressSubject = new BehaviorSubject<OnboardingProgress>(createInitialOnboardingProgress());

  /**
   * Stream com progresso atual do onboarding.
   */
  readonly progress$: Observable<OnboardingProgress> = this.progressSubject.asObservable();

  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Informa quantos passos já foram concluídos (0-8).
   * @returns Quantidade de passos concluídos
   */
  get completedStepsCount(): number {
    return this.progressSubject.value.completedSteps.length;
  }

  /**
   * Indica se setup mínimo foi concluído (canais + calendário).
   * @returns true quando a organização pode esconder o banner
   */
  get hasMinimumSetup(): boolean {
    const progress = this.progressSubject.value;
    return progress.channelsConfigured && progress.calendarConfigured;
  }

  /**
   * Indica se o onboarding foi finalizado explicitamente pelo gestor.
   * @returns true quando `completedAt` existe ou o passo 8 foi concluído
   */
  get isOnboardingComplete(): boolean {
    const progress = this.progressSubject.value;
    return Boolean(progress.completedAt) || progress.completedSteps.includes(8);
  }

  /**
   * Define se o banner de onboarding deve aparecer no layout autenticado.
   * Aparece no setup mínimo pendente **ou** no checklist opcional (passos 6–7).
   * @param progress Progresso atual de onboarding
   * @returns true quando ainda há setup pendente e o fluxo não foi concluído
   */
  shouldShowOnboardingBanner(progress: OnboardingProgress): boolean {
    if (progress.completedAt || progress.completedSteps.includes(8)) {
      return false;
    }

    return !canUseFirstWinShortcut(progress) || hasDeferredOnboardingSteps(progress);
  }

  /**
   * Indica se o CTA “Ver quem sumiu agora” deve aparecer no wizard.
   * @param progress Progresso atual
   * @returns true após canais + calendário configurados
   */
  canShowFirstWinCta(progress: OnboardingProgress): boolean {
    return canUseFirstWinShortcut(progress);
  }

  /**
   * Indica se o checklist opcional (categorias/membros) ainda está pendente.
   * @param progress Progresso atual
   * @returns true quando passos 6–7 podem ser feitos depois do first-win
   */
  hasDeferredSetup(progress: OnboardingProgress): boolean {
    return hasDeferredOnboardingSteps(progress);
  }

  /**
   * Retorna o estado atual em memória.
   * @returns Progresso atual
   */
  get currentProgress(): OnboardingProgress {
    return this.progressSubject.value;
  }

  /**
   * Carrega progresso de onboarding da API por organização.
   * @param orgId Identificador da organização autenticada
   * @returns Observable com progresso carregado (ou fallback local)
   */
  load(orgId: string): Observable<OnboardingProgress> {
    if (!orgId) {
      return of(this.currentProgress);
    }

    return this.httpClient.get<{ onboarding: OnboardingProgress }>(`/api/v1/org/${orgId}/onboarding`).pipe(
      map((response) => this.normalizeProgress(response.onboarding)),
      tap((progress) => this.progressSubject.next(progress)),
      catchError(() => of(this.currentProgress)),
    );
  }

  /**
   * Atualiza progresso de onboarding no backend e sincroniza estado local.
   * @param orgId Identificador da organização autenticada
   * @param partial Campos parciais a serem atualizados
   * @returns Observable com progresso consolidado pós-atualização
   */
  save(orgId: string, partial: Partial<OnboardingProgress>): Observable<OnboardingProgress> {
    const merged = this.normalizeProgress({ ...this.currentProgress, ...partial });
    if (!orgId) {
      this.progressSubject.next(merged);
      return of(merged);
    }

    return this.httpClient.put<{ onboarding: OnboardingProgress }>(`/api/v1/org/${orgId}/onboarding`, { onboarding: merged }).pipe(
      map((response) => this.normalizeProgress(response.onboarding)),
      tap((progress) => this.progressSubject.next(progress)),
      catchError(() => {
        this.progressSubject.next(merged);
        return of(merged);
      }),
    );
  }

  /**
   * Atualiza estado local sem chamar backend (uso em fallback/offline).
   * @param partial Campos parciais a aplicar
   * @returns Estado atualizado após merge e normalização
   */
  patchLocal(partial: Partial<OnboardingProgress>): OnboardingProgress {
    const merged = this.normalizeProgress({ ...this.currentProgress, ...partial });
    this.progressSubject.next(merged);
    return merged;
  }

  /**
   * Normaliza valores para manter integridade do progresso.
   * @param progress Dados recebidos da API ou memória local
   * @returns Progresso validado e ordenado
   */
  private normalizeProgress(progress: Partial<OnboardingProgress>): OnboardingProgress {
    const currentStep = this.normalizeStep(progress.currentStep ?? 1);
    const completedSteps = Array.from(new Set([...(progress.completedSteps ?? []), 1]))
      .filter((step) => Number.isInteger(step) && step >= 1 && step <= 8)
      .sort((left, right) => left - right);

    return {
      currentStep,
      completedSteps,
      botConnected: Boolean(progress.botConnected),
      guildSelected: Boolean(progress.guildSelected),
      channelsConfigured: Boolean(progress.channelsConfigured),
      calendarConfigured: Boolean(progress.calendarConfigured),
      categoriesConfigured: Boolean(progress.categoriesConfigured),
      membersAssigned: Boolean(progress.membersAssigned),
      completedAt: progress.completedAt,
    };
  }

  /**
   * Normaliza passo para o intervalo permitido de 1 a 8.
   * @param step Número recebido para o passo atual
   * @returns Passo válido no intervalo do wizard
   */
  private normalizeStep(step: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 {
    const safeStep = Number.isInteger(step) ? Math.max(1, Math.min(8, step)) : 1;
    return safeStep as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  }
}

