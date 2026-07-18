/**
 * Progresso do onboarding persistido por organização.
 */
export interface OnboardingProgress {
  currentStep: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  completedSteps: number[];
  botConnected: boolean;
  guildSelected: boolean;
  channelsConfigured: boolean;
  calendarConfigured: boolean;
  categoriesConfigured: boolean;
  membersAssigned: boolean;
  completedAt?: string;
}

/**
 * Cria estado inicial de onboarding para organizações recém-criadas.
 * @returns Estado inicial com primeiro passo concluído
 * @example
 * const initial = createInitialOnboardingProgress();
 * console.log(initial.currentStep); // 1
 */
export function createInitialOnboardingProgress(): OnboardingProgress {
  return {
    currentStep: 1,
    completedSteps: [1],
    botConnected: false,
    guildSelected: false,
    channelsConfigured: false,
    calendarConfigured: false,
    categoriesConfigured: false,
    membersAssigned: false,
  };
}

/**
 * Indica se o setup mínimo (canais + calendário/limiares) já permite o first-win.
 * @param progress Progresso atual de onboarding
 * @returns true quando o gestor pode ir ao dashboard sem passos 6–7
 */
export function canUseFirstWinShortcut(progress: OnboardingProgress): boolean {
  return progress.channelsConfigured && progress.calendarConfigured;
}

/**
 * Indica se categorias/membros ainda estão pendentes após o setup mínimo.
 * @param progress Progresso atual de onboarding
 * @returns true quando há checklist opcional (passos 6–7) a mostrar
 */
export function hasDeferredOnboardingSteps(progress: OnboardingProgress): boolean {
  if (progress.completedAt || progress.completedSteps.includes(8)) {
    return false;
  }
  if (!canUseFirstWinShortcut(progress)) {
    return false;
  }
  return !progress.categoriesConfigured || !progress.membersAssigned;
}

