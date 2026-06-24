import { expect, test } from '@playwright/test';
import { registerE2EUser } from './helpers/auth.fixture';

/**
 * Gera um JWT mínimo com expiração futura para desbloquear `authGuard` em mocks E2E.
 *
 * @param organizationId Organização ativa incluída no payload
 * @returns Token JWT assinado de forma fake (válido apenas para o frontend)
 */
function createMockAccessToken(organizationId: string): string {
  const toBase64Url = (input: string): string =>
    Buffer.from(input)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = toBase64Url(
    JSON.stringify({
      sub: 'user-e2e',
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      memberships: [{ organizationId, role: 'owner' }],
    }),
  );

  return `${header}.${payload}.e2e-signature`;
}

test.describe('Jornada E2E - Quem sumiu', () => {
  /**
   * Este cenário assume backend disponível para cadastro/login real.
   * Se o backend não estiver acessível, o teste usa mocks de auth e mantém
   * o frontend em execução via `webServer` configurado no `playwright.config.ts`.
   */
  test('signup -> onboarding completo -> dashboard com primeiro alerta', async ({ page, request }) => {
    const authSetup = await registerE2EUser(request);
    const organizationId = 'org-e2e-quem-sumiu';
    const guildId = 'guild-e2e-quem-sumiu';

    if (!authSetup.registered) {
      await page.route('**/api/v1/auth/login', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            accessToken: createMockAccessToken(organizationId),
            user: {
              id: 'user-e2e',
              email: authSetup.credentials.email,
              displayName: authSetup.credentials.displayName,
              isSuperAdmin: false,
            },
            organization: {
              id: organizationId,
              name: authSetup.credentials.organizationName,
              slug: 'org-e2e',
            },
            organizations: [
              {
                id: organizationId,
                name: authSetup.credentials.organizationName,
                slug: 'org-e2e',
                role: 'owner',
                status: 'active',
              },
            ],
          }),
        });
      });
    }

    await page.route('**/api/v1/org/*/onboarding', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          onboarding: {
            currentStep: 8,
            completedSteps: [1, 2, 3, 4, 5, 6, 7, 8],
            botConnected: true,
            guildSelected: true,
            channelsConfigured: true,
            calendarConfigured: true,
            categoriesConfigured: true,
            membersAssigned: true,
            completedAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route('**/api/v1/org/*/onboarding/progress', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          onboarding: {
            currentStep: 8,
            completedSteps: [1, 2, 3, 4, 5, 6, 7, 8],
            guildSelected: true,
            channelsConfigured: true,
            calendarConfigured: true,
            completedAt: new Date().toISOString(),
          },
        }),
      });
    });

    await page.route('**/api/v1/org/*/discord/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          botConnected: true,
          activeConnection: {
            guildId,
            guildName: 'Guild Dev E2E',
            isMonitoringEnabled: true,
          },
        }),
      });
    });

    await page.route('**/api/v1/org/*/guilds/*/reports/inactivity/intraday', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          report: {
            generatedAt: new Date().toISOString(),
            timezone: 'America/Sao_Paulo',
            elapsedWorkPercent: 42,
            elapsedWorkSeconds: 15120,
            totalWorkSeconds: 36000,
            isBusinessDay: true,
            isWithinWorkHours: true,
            settings: {
              lateStartThresholdPercent: 30,
              minCollaborationPercentOfElapsed: 20,
            },
            concernEntries: [
              {
                trackedUserId: 'tracked-dev-test',
                discordId: 'discord-dev-test',
                displayName: 'Dev Test',
                status: 'not_started',
                elapsedWorkPercent: 42,
                collaborationPercentOfElapsed: 0,
                collaborationSecondsInWorkWindow: 0,
                elapsedWorkSeconds: 15120,
                hasAppearedToday: false,
              },
            ],
          },
        }),
      });
    });

    await page.route('**/api/v1/org/*/guilds/*/reports/inactivity/weekly', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          report: {
            entries: [],
          },
        }),
      });
    });

    await page.goto('/login');
    await page.locator('input[name="email"]').fill(authSetup.credentials.email);
    await page.locator('input[name="password"]').fill(authSetup.credentials.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/app\/dashboard/);

    await page.goto('/app/dashboard');
    await expect(page.getByText('Dev Test')).toBeVisible();
  });
});
