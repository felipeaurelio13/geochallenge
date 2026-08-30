import { test, expect } from '@playwright/test';
import { mockGameApis } from './helpers/gameApiMocks';

test.describe('layout de ronda mobile', () => {
  test.beforeEach(async ({ page }) => {
    await mockGameApis(page);
  });

  test('mantiene alternativas de autoenvío visibles y media contenida', async ({ page }) => {
    await page.goto('/game/single?category=FLAG');

    await expect(page.getByTestId('mobile-action-tray')).toBeVisible();

    const optionButtons = page.locator('.game-options-wrap button');
    await expect(optionButtons).toHaveCount(4);

    const optionsWrap = page.locator('.game-options-wrap');
    await optionsWrap.evaluate((node) => {
      node.scrollTo({ top: node.scrollHeight, behavior: 'auto' });
    });

    await expect(optionButtons.last()).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Argentina' })).toBeEnabled();

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

  test('al seleccionar sólo habilita Confirmar sin desplazar ni redimensionar el CTA', async ({ page }) => {
    await page.goto('/game/single?category=FLAG');

    const confirmButton = page.getByTestId('mobile-action-tray').getByRole('button', { name: /^(Confirmar|Submit)$/ });
    await expect(confirmButton).toBeDisabled();
    const beforeSelection = await confirmButton.boundingBox();

    await page.getByRole('button', { name: 'Argentina' }).click();

    await expect(confirmButton).toBeEnabled();
    await expect(page.getByText(/^(Selección lista para confirmar\.|Selection ready to confirm\.)$/)).toHaveClass(/sr-only/);
    const afterSelection = await confirmButton.boundingBox();

    expect(beforeSelection).not.toBeNull();
    expect(afterSelection).toEqual(beforeSelection);
  });
});
