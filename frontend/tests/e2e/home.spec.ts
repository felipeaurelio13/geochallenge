import { test, expect } from 'playwright/test';
import frontendPackage from '../../package.json';

test('home renderiza CTA principales en mobile', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'GeoChallenge' })).toBeVisible();

  const loginLink = page.getByRole('link', { name: /^(Login|Iniciar sesión)$/ });
  const registerLink = page.getByRole('link', { name: /^(Register|Registrarse)$/ });

  await expect(loginLink).toBeVisible();
  await expect(registerLink).toBeVisible();
  await expect(page.getByText(`v${frontendPackage.version}`)).toBeVisible();
});
