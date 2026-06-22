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

