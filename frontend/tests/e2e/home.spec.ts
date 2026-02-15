import { test, expect } from 'playwright/test';

test('home renderiza CTA principales en mobile', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'GeoChallenge' })).toBeVisible();
  // Check for either Spanish or English button text
  const loginLink = page.getByRole('link', { name: /^(Login|Iniciar sesión)$/ });
  const registerLink = page.getByRole('link', { name: /^(Register|Registrarse)$/ });
  await expect(loginLink).toBeVisible();
  await expect(registerLink).toBeVisible();
  await expect(page.getByText('v1.2.7')).toBeVisible();
});
