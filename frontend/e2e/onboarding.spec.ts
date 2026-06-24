import { expect, test } from '@playwright/test';

test.describe('Smoke de onboarding e landing', () => {
  test('carrega landing page', async ({ page }) => {
    const response = await page.goto('/landing');

    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/landing$/);
  });

  test('carrega página de login', async ({ page }) => {
    const response = await page.goto('/login');

    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/login$/);
  });
});
