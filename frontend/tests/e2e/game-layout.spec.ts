import { expect, test } from '@playwright/test';

type DevicePreset = {
  width: number;
  height: number;
};

const VIEWPORTS: DevicePreset[] = [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
];

const gameStartPayload = {
  gameConfig: {
    questionsCount: 10,
    timePerQuestion: 10,
    category: 'FLAG',
  },
  questions: Array.from({ length: 10 }, (_, index) => ({
    id: `q-${index + 1}`,
    category: 'FLAG',
    questionData: 'Argentina',
    options: ['Argentina', 'Chile', 'Uruguay', 'Paraguay'],
    correctAnswer: 'Argentina',
    difficulty: 'MEDIUM',
    imageUrl: 'https://flagcdn.com/w320/ar.png',
  })),
};

test.describe('game viewport layout without scroll', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
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
        body: JSON.stringify({
          isCorrect: true,
          correctAnswer: 'Argentina',
          points: 100,
          timeBonus: 10,
        }),
      });
    });

    await page.route('**/api/game/finish', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ score: 1000, correctAnswers: 10, totalQuestions: 10 }),
      });
    });
  });

  for (const viewport of VIEWPORTS) {
    test(`keeps CTA and four options visible at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/game/single?category=FLAG');

      await expect(page.getByRole('button', { name: /confirmar|submit/i })).toBeVisible();
      const footerVersion = page.getByText(/GeoChallenge ©|v\d+\.\d+\.\d+/i);
      await expect(footerVersion).toHaveCount(0);

      const optionButtons = page.locator('button[data-state]');
      await expect(optionButtons).toHaveCount(4);

      const viewportMetrics = await page.evaluate(() => ({
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
      }));

      expect(viewportMetrics.scrollHeight).toBeLessThanOrEqual(viewportMetrics.innerHeight);
      expect(viewportMetrics.scrollWidth).toBeLessThanOrEqual(viewportMetrics.innerWidth);

      const confirmButton = page.getByRole('button', { name: /confirmar|submit/i });
      const ctaBox = await confirmButton.boundingBox();
      expect(ctaBox).not.toBeNull();
      expect(ctaBox!.bottom).toBeLessThanOrEqual(viewportMetrics.innerHeight);

      for (let index = 0; index < 4; index += 1) {
        const box = await optionButtons.nth(index).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.top).toBeGreaterThanOrEqual(0);
        expect(box!.bottom).toBeLessThanOrEqual(viewportMetrics.innerHeight);
      }
    });
  }
});
