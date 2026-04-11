import { test, expect } from '@playwright/test';
import { mockGameApis } from './helpers/gameApiMocks';

test.describe('layout de ronda mobile dark mode', () => {
  test.beforeEach(async ({ page }) => {
    await mockGameApis(page);
    await page.emulateMedia({ colorScheme: 'dark' });
  });

  test('mantiene CTA visible y sin overflow horizontal accidental en tema oscuro', async ({ page }, testInfo) => {
    await page.goto('/game/single?category=FLAG');

    await expect(page.getByRole('button', { name: 'Confirmar' })).toBeVisible();
    await expect(page.locator('.game-options-wrap button')).toHaveCount(4);

    const hasHorizontalOverflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth > root.clientWidth;
    });

    expect(hasHorizontalOverflow).toBeFalsy();

    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach(`game-darkmode-${testInfo.project.name}.png`, {
      body: screenshot,
      contentType: 'image/png',
    });
  });
});
