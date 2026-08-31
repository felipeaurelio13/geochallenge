import { test, expect } from '@playwright/test';

test('home renderiza CTA principales en mobile', async ({ page }, testInfo) => {
  for (const healthPath of ['**/health', '**/ping']) {
    await page.route(healthPath, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'healthy' }),
      });
    });
  }

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'GeoChallenge' })).toBeVisible();

  const loginLink = page.getByRole('link', { name: /^(Login|Iniciar sesión)$/ });
  const registerLink = page.getByRole('link', { name: /^(Register|Registrarse)$/ });

  await expect(loginLink).toBeVisible();
  await expect(registerLink).toBeVisible();
  const screenshot = await page.screenshot({ animations: 'disabled', caret: 'hide', fullPage: false });
  await testInfo.attach('home-entry.png', {
    body: screenshot,
    contentType: 'image/png',
  });
});

