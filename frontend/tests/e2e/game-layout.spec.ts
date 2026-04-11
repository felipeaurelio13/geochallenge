import { test, expect } from '@playwright/test';
import { mockGameApis } from './helpers/gameApiMocks';

test.describe('layout de ronda mobile', () => {
  test.beforeEach(async ({ page }) => {
    await mockGameApis(page);
  });

  test('mantiene CTA visible, media contenida y alternativas accesibles', async ({ page }) => {
    await page.goto('/game/single?category=FLAG');

    const confirmButton = page.getByRole('button', { name: 'Confirmar' });
    await expect(confirmButton).toBeVisible();

    const optionButtons = page.locator('.game-options-wrap button');
    await expect(optionButtons).toHaveCount(4);

    const optionsWrap = page.locator('.game-options-wrap');
    await optionsWrap.evaluate((node) => {
      node.scrollTo({ top: node.scrollHeight, behavior: 'auto' });
    });

    await expect(optionButtons.last()).toBeInViewport();

    const media = page.locator('.media-box img');
    await expect(media).toBeVisible();

    const isContained = await media.evaluate((img) => {
      const styles = window.getComputedStyle(img);
      const rect = img.getBoundingClientRect();
      const parentRect = img.parentElement?.getBoundingClientRect();
      return {
        fit: styles.objectFit,
        insideParent: Boolean(parentRect && rect.height <= parentRect.height + 0.5 && rect.width <= parentRect.width + 0.5),
      };
    });

    expect(isContained.fit).toBe('contain');
    expect(isContained.insideParent).toBeTruthy();
  });
});
