import { expect, test } from '@playwright/test';
import { mockGameApis } from './helpers/gameApiMocks';

test.describe('feedback de la vuelta al mundo diaria', () => {
  test.beforeEach(async ({ page }) => {
    await mockGameApis(page);
    await page.addInitScript(() => window.localStorage.setItem('i18nextLng', 'es'));

    await page.route(/\/api\/game\/daily(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          questions: [{
            id: 'daily-flag-1',
            category: 'FLAG',
            questionText: '¿De qué país es esta bandera?',
            questionData: 'Ivory Coast',
            imageUrl: null,
            options: ['Ivory Coast', 'Ghana', 'Nigeria', 'Guinea'],
            difficulty: 'MEDIUM',
          }],
          dayKey: '2026-08-30',
          today: '2026-08-30',
          alreadyPlayed: false,
          dailyVersion: 'world-tour-v1',
          tour: { totalStops: 1, stops: [{ index: 0, region: 'AFRICA', category: 'FLAG' }] },
        }),
      });
    });

    await page.route('**/api/game/daily/answer', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          questionId: 'daily-flag-1',
          isCorrect: false,
          correctAnswer: 'Ivory Coast',
          points: 0,
          countryCode: 'CI',
          region: 'AFRICA',
        }),
      });
    });
  });

  test('preserva los targets de las cuatro alternativas y mantiene Siguiente accesible', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'Desktop', 'La regresión corresponde al layout mobile.');

    await page.goto('/daily');
    await page.getByRole('button', { name: /daily\.startJourney|Comenzar/i }).click();

    const options = page.locator('.game-options-wrap button');
    await expect(options).toHaveCount(4);
    const before = await options.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));

    await page.getByRole('button', { name: 'Ghana' }).click();
    await page.getByRole('button', { name: /game\.submit|Confirmar/i }).click();

    await expect(page.getByText('Costa de Marfil', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /daily\.finish|Ver resultado/i })).toBeVisible();

    const after = await options.evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
    expect(after.every((height, index) => height >= 44 && height >= before[index] - 1)).toBeTruthy();

    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(hasHorizontalOverflow).toBeFalsy();
  });
});
