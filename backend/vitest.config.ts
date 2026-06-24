import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/services/**',
        'src/repositories/**',
        'src/api/middleware/**',
      ],
      // Arquivos com alto acoplamento de integração ficam fora até termos suíte dedicada.
      exclude: [
        'src/services/authService.ts',
        'src/services/billingService.ts',
        'src/services/guildService.ts',
        'src/services/inactivityService.ts',
        'src/services/liveStatsService.ts',
        'src/services/plannedAbsenceService.ts',
        'src/services/presenceService.ts',
        'src/services/reportService.ts',
        'src/services/voiceService.ts',
        'src/repositories/dailyReportRepository.ts',
        'src/repositories/presenceSessionRepository.ts',
        'src/repositories/voiceSessionRepository.ts',
        'src/repositories/plannedAbsenceRepository.ts',
        'src/services/webhookService.ts',
        'src/services/adminPlatformService.ts',
        'src/services/adminPlanService.ts',
        'src/services/dashboardLiveService.ts',
        'src/services/discordApplicationService.ts',
        'src/services/gamificationInsightsService.ts',
        'src/services/gamificationRankingService.ts',
        'src/services/gamificationService.ts',
        'src/services/guildMonitoringService.ts',
        'src/services/inactivitySettingsService.ts',
        'src/services/intradayInactivityService.ts',
        'src/services/platformAuthService.ts',
        'src/services/pushService.ts',
        'src/services/textActivityService.ts',
        'src/services/trackedUserService.ts',
      ],
      thresholds: {
        lines: 80,
      },
    },
  },
});
