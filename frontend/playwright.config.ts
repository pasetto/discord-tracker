import { defineConfig } from '@playwright/test';
import { assertSafeE2EBaseURL } from './src/app/core/e2e-safety/assert-safe-e2e-base-url';

/**
 * Configuração de E2E Playwright para smoke tests do frontend.
 * Recusa `E2E_BASE_URL` apontando para o piloto público (disc.econdos.com.br).
 */
const e2eBaseURL = assertSafeE2EBaseURL(process.env.E2E_BASE_URL || 'http://127.0.0.1:4200');

const playwrightConfig = defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: e2eBaseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run start -- --host 127.0.0.1 --port 4200',
    url: 'http://127.0.0.1:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

/** Exporta configuração padrão de execução do Playwright. */
export default playwrightConfig;
