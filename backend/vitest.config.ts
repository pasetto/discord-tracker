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
      ],
      thresholds: {
        lines: 80,
      },
    },
  },
});
