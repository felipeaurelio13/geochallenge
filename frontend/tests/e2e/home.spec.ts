import { test, expect } from 'playwright/test';

test('home renderiza CTA principales en mobile', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'GeoChallenge' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Crear cuenta' })).toBeVisible();
  await expect(page.getByText('v1.1.22')).toBeVisible();
});
