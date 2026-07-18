import { expect, test, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Smoke do shell autenticado pós-SYN-69 (paliativo até QA).
 * Viewports: 375 / 768 / 1280 — hambúrguer, logo, bottom-nav, rotas principais.
 */

const SCREENSHOT_DIR = path.join('e2e', 'artifacts', 'shell-smoke');

const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
] as const;

const ROUTES = [
  { path: '/app/dashboard', label: 'dashboard' },
  { path: '/app/live', label: 'live' },
  { path: '/app/reports/inactivity', label: 'inactivity' },
  { path: '/app/settings/discord', label: 'settings' },
] as const;

/**
 * JWT mínimo para desbloquear `authGuard` em mocks E2E.
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
      sub: 'user-shell-smoke',
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      memberships: [{ organizationId, role: 'owner' }],
    }),
  );

  return `${header}.${payload}.e2e-signature`;
}

/**
 * Instala mocks mínimos de auth/API para navegar o shell sem backend.
 */
async function installShellMocks(page: Page): Promise<void> {
  const organizationId = 'org-shell-smoke';
  const guildId = 'guild-shell-smoke';
  const accessToken = createMockAccessToken(organizationId);

  await page.addInitScript(
    ({ token, orgId, gId }) => {
      const user = {
        id: 'user-shell-smoke',
        email: 'shell-smoke@syntra.test',
        displayName: 'Shell Smoke',
        isSuperAdmin: false,
      };
      const organization = { id: orgId, name: 'Org Smoke', slug: 'org-smoke' };
      localStorage.setItem('syntra.auth.token', token);
      localStorage.setItem('syntra.orgId', orgId);
      localStorage.setItem('syntra.auth.user', JSON.stringify(user));
      localStorage.setItem('syntra.auth.organization', JSON.stringify(organization));
      localStorage.setItem(
        'syntra.auth.organizations',
        JSON.stringify([{ ...organization, role: 'owner', status: 'active' }]),
      );
      localStorage.setItem('syntra.guildId', gId);
      localStorage.setItem('syntra.guildName', 'Guild Smoke');
    },
    { token: accessToken, orgId: organizationId, gId: guildId },
  );

  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/auth/me') || url.includes('/auth/session')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-shell-smoke',
            email: 'shell-smoke@syntra.test',
            displayName: 'Shell Smoke',
            isSuperAdmin: false,
          },
          organization: { id: organizationId, name: 'Org Smoke', slug: 'org-smoke' },
          organizations: [
            {
              id: organizationId,
              name: 'Org Smoke',
              slug: 'org-smoke',
              role: 'owner',
              status: 'active',
            },
          ],
        }),
      });
      return;
    }

    if (url.includes('/discord/status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          botConnected: true,
          activeConnection: {
            guildId,
            guildName: 'Guild Smoke',
            isMonitoringEnabled: true,
          },
        }),
      });
      return;
    }

    if (url.includes('/onboarding')) {
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
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, report: { entries: [], concernEntries: [] }, members: [] }),
    });
  });
}

/**
 * Persiste screenshot nomeado sob e2e/artifacts/shell-smoke.
 */
async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: false,
  });
}

test.describe('Shell smoke pós-SYN-69', () => {
  test('hambúrguer, logo, bottom-nav e rotas em 375/768/1280', async ({ page }) => {
    await installShellMocks(page);

    const checklist: string[] = [];

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/app/dashboard', { waitUntil: 'networkidle' });
      await expect(page).toHaveURL(/\/app\/dashboard/);

      const isDesktop = vp.width >= 1280;
      const bottomNav = page.getByRole('navigation', { name: 'Navegação principal mobile' });
      const hamburger = page.getByRole('button', { name: 'Toggle Sidebar' });

      if (isDesktop) {
        await expect(bottomNav).toBeHidden();
        checklist.push(`[x] ${vp.name}px: bottom-nav oculto (desktop xl)`);
      } else {
        await expect(bottomNav).toBeVisible();
        checklist.push(`[x] ${vp.name}px: bottom-nav visível`);

        // Hambúrguer abre drawer (fora da tela → visível na viewport)
        const sidebar = page.locator('aside').first();
        await hamburger.click();
        await expect
          .poll(async () => {
            const box = await sidebar.boundingBox();
            return box !== null && box.x >= -1 && box.x < vp.width;
          })
          .toBeTruthy();
        await shot(page, `${vp.name}-hamburger-open`);
        checklist.push(`[x] ${vp.name}px: hambúrguer abre drawer`);

        await hamburger.click();
        await expect
          .poll(async () => {
            const box = await sidebar.boundingBox();
            return box === null || box.x + box.width <= 1;
          })
          .toBeTruthy();
        checklist.push(`[x] ${vp.name}px: hambúrguer fecha drawer`);
      }

      // Logo tema claro
      await page.evaluate(() => document.documentElement.classList.remove('dark'));
      await page.waitForTimeout(100);
      const lightLogo = page.locator('img[src="/images/logo/logo.svg"]').first();
      await expect(lightLogo).toBeVisible();
      await shot(page, `${vp.name}-logo-light`);
      checklist.push(`[x] ${vp.name}px: logo tema claro visível`);

      // Logo tema escuro
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.waitForTimeout(100);
      const darkLogo = page.locator('img[src="/images/logo/logo-dark.svg"]').first();
      await expect(darkLogo).toBeVisible();
      await shot(page, `${vp.name}-logo-dark`);
      checklist.push(`[x] ${vp.name}px: logo tema escuro visível`);
      await page.evaluate(() => document.documentElement.classList.remove('dark'));

      // Rotas principais
      for (const route of ROUTES) {
        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveURL(new RegExp(route.path.replace(/\//g, '\\/')));
        await shot(page, `${vp.name}-${route.label}`);
        checklist.push(`[x] ${vp.name}px: rota ${route.path}`);
      }
    }

    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'CHECKLIST.md'),
      [`# Shell smoke checklist (SYN-75)`, '', ...checklist, ''].join('\n'),
      'utf8',
    );
  });
});
