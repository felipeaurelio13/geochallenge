import { test, expect } from '@playwright/test';

const gameStartPayload = {
  gameConfig: {
    questionsCount: 10,
    timePerQuestion: 10,
    category: 'FLAG',
  },
  questions: [
    {
      id: 'flag-1',
      category: 'FLAG',
      questionText: '¿De qué país es esta bandera?',
      questionData: 'Argentina',
      imageUrl: 'https://flagcdn.com/w320/ar.png',
      options: ['Argentina', 'Uruguay', 'Chile', 'Paraguay'],
      correctAnswer: 'Argentina',
      difficulty: 'MEDIUM',
    },
  ],
};

async function mockGameApis(page: import('@playwright/test').Page) {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'e2e-user',
          username: 'E2E',
          email: 'e2e@local.dev',
          preferredLanguage: 'es',
          highScore: 0,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
        },
      }),
    });
  });

  await page.route('**/api/game/start**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(gameStartPayload),
    });
  });

  await page.route('**/api/game/answer', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ isCorrect: true, correctAnswer: 'Argentina', points: 100, timeBonus: 10 }),
    });
  });
}

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
