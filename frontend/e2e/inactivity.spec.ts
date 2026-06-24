import { expect, test } from '@playwright/test';

test.describe('Smoke de relatório de inatividade', () => {
  test('landing menciona quem sumiu', async ({ page }) => {
    await page.goto('/landing');
    await expect(page.getByText(/quem sumiu/i)).toBeVisible();
  });

  test('rota de relatório exige autenticação', async ({ page }) => {
    await page.goto('/app/reports/inactivity');
    await expect(page).toHaveURL(/\/login/);
  });

  test('rota de ausências ativas exige autenticação', async ({ page }) => {
    await page.goto('/app/reports/absences');
    await expect(page).toHaveURL(/\/login/);
  });
});
