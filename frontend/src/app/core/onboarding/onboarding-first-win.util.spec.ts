import { createInitialOnboardingProgress } from './onboarding-progress.model';
import {
  FIRST_WIN_CTA_LABEL,
  FIRST_WIN_DASHBOARD_ROUTE,
  hasFirstWinSetup,
  hasPendingOptionalOnboardingSteps,
  resolveOnboardingBannerCtaLabel,
  resolveOnboardingBannerMessage,
} from './onboarding-first-win.util';

describe('onboarding-first-win.util', () => {
  it('expõe rota e label do CTA first-win', () => {
    expect(FIRST_WIN_DASHBOARD_ROUTE).toBe('/app/dashboard');
    expect(FIRST_WIN_CTA_LABEL).toBe('Ver quem sumiu agora');
  });

  it('libera first-win apenas com canais + calendário', () => {
    const base = createInitialOnboardingProgress();
    expect(hasFirstWinSetup({ ...base, channelsConfigured: false, calendarConfigured: false })).toBeFalse();
    expect(hasFirstWinSetup({ ...base, channelsConfigured: true, calendarConfigured: false })).toBeFalse();
    expect(hasFirstWinSetup({ ...base, channelsConfigured: true, calendarConfigured: true })).toBeTrue();
  });

  it('mantém checklist/banner após first-win até categorias/membros', () => {
    const afterFirstWin = {
      ...createInitialOnboardingProgress(),
      currentStep: 6 as const,
      completedSteps: [1, 2, 3, 4, 5],
      channelsConfigured: true,
      calendarConfigured: true,
      categoriesConfigured: false,
      membersAssigned: false,
    };

    expect(hasPendingOptionalOnboardingSteps(afterFirstWin)).toBeTrue();
    expect(resolveOnboardingBannerMessage(afterFirstWin)).toContain('dashboard de quem sumiu');
    expect(resolveOnboardingBannerCtaLabel(afterFirstWin)).toBe('Abrir checklist');
  });
});
