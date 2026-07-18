/**
 * Copy e helpers de first-win / banner — reexporta o modelo e adiciona textos de UI.
 */
import {
  OnboardingProgress,
  canUseFirstWinShortcut,
  hasDeferredOnboardingSteps,
} from './onboarding-progress.model';

export { canUseFirstWinShortcut, hasDeferredOnboardingSteps };

/**
 * Rota do dashboard após o first-win (quem sumiu).
 */
export const FIRST_WIN_DASHBOARD_ROUTE = '/app/dashboard' as const;

/**
 * Label do CTA primário pós passos 4+5.
 */
export const FIRST_WIN_CTA_LABEL = 'Ver quem sumiu agora' as const;

/**
 * Alias legível: setup mínimo (canais + calendário) liberado.
 * @param progress Progresso atual
 * @returns true quando first-win está disponível
 */
export function hasFirstWinSetup(progress: OnboardingProgress): boolean {
  return canUseFirstWinShortcut(progress);
}

/**
 * Alias: checklist opcional (6–7) ainda pendente após first-win.
 * @param progress Progresso atual
 * @returns true quando o banner pós-setup deve continuar
 */
export function hasPendingOptionalOnboardingSteps(progress: OnboardingProgress): boolean {
  return hasDeferredOnboardingSteps(progress);
}

/**
 * Texto do banner conforme estágio (setup mínimo vs checklist opcional).
 * @param progress Progresso atual
 * @returns Mensagem curta para o layout autenticado
 */
export function resolveOnboardingBannerMessage(progress: OnboardingProgress): string {
  if (hasDeferredOnboardingSteps(progress)) {
    return 'Organize categorias e membros quando quiser — o dashboard de quem sumiu já está liberado.';
  }
  return 'Complete canais e calendário para ver quem sumiu em menos de 10 minutos.';
}

/**
 * Label do botão do banner conforme estágio.
 * @param progress Progresso atual
 * @returns Texto do CTA do banner
 */
export function resolveOnboardingBannerCtaLabel(progress: OnboardingProgress): string {
  if (hasDeferredOnboardingSteps(progress)) {
    return 'Abrir checklist';
  }
  return 'Continuar configuração';
}
