import { expect, test } from '@playwright/test';

test.describe('Smoke de onboarding e landing', () => {
  test('carrega landing page', async ({ page }) => {
    const response = await page.goto('/');

    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/$/);
  });

  test('carrega página de signin', async ({ page }) => {
    const response = await page.goto('/signin');

    expect(response?.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/signin$/);
  });
});
