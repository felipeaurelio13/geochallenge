import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mockGameApis } from './helpers/gameApiMocks';

const questions = [
  {
    id: 'perfect-1', category: 'CAPITAL', questionText: '¿Cuál es la capital de Chile?',
    options: ['Santiago', 'Lima', 'Bogotá', 'Quito'], correctAnswer: 'Santiago', difficulty: 'MEDIUM',
  },
  {
    id: 'perfect-2', category: 'CAPITAL', questionText: '¿Cuál es la capital de Perú?',
    options: ['Lima', 'Santiago', 'Bogotá', 'Quito'], correctAnswer: 'Lima', difficulty: 'MEDIUM',
  },
  {
    id: 'perfect-3', category: 'MAP', questionText: 'Selecciona Chile en el mapa',
    options: [], correctAnswer: 'Chile', difficulty: 'MEDIUM',
  },
  {
    id: 'perfect-4', category: 'CAPITAL', questionText: '¿Cuál es la capital de Colombia?',
    options: ['Bogotá', 'Lima', 'Quito', 'Santiago'], correctAnswer: 'Bogotá', difficulty: 'MEDIUM',
  },
];

async function capture(page: Page, testInfo: TestInfo, state: string) {
  await testInfo.attach(`perfect-round-${state}`, {
    body: await page.screenshot({ animations: 'disabled' }),
    contentType: 'image/png',
  });
}

test.describe('Perfect Round screenshots', () => {
  test.describe.configure({ mode: 'serial' });

  test('captures the comparable Single/Mixed round states', async ({ page }, testInfo) => {
    let answerCount = 0;
    await mockGameApis(page);
    await page.route('**/api/game/start**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ gameConfig: { questionsCount: questions.length, timePerQuestion: 30, category: 'MIXED' }, questions }),
      });
    });
    await page.route('**/api/game/answer', async (route) => {
      answerCount += 1;
      const isFirstQuestion = answerCount === 1;
      await new Promise((resolve) => setTimeout(resolve, 650));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isCorrect: isFirstQuestion,
          correctAnswer: isFirstQuestion ? 'Santiago' : answerCount === 2 ? 'Lima' : answerCount === 4 ? 'Bogotá' : 'Chile',
          points: isFirstQuestion ? 742 : 0,
          timeBonus: 10,
          correctLocation: { lat: -33.45, lng: -70.67 },
        }),
      });
    });

    await page.goto('/game/single?category=MIXED');
    const actionTray = page.getByTestId('mobile-action-tray');
    const confirm = actionTray.getByRole('button', { name: /^(Confirmar|Submit)$/ });
    await expect(confirm).toBeDisabled();
    await capture(page, testInfo, '01-initial');

    const beforeSelection = await confirm.boundingBox();
    await page.getByRole('button', { name: 'Santiago' }).click();
    await expect(confirm).toBeEnabled();
    expect(await confirm.boundingBox()).toEqual(beforeSelection);
    await capture(page, testInfo, '02-selected');

    await confirm.click();
    await expect(actionTray.getByRole('button', { name: /^(Validando…|Validating…)$/ })).toBeVisible();
    await capture(page, testInfo, '03-validating');
    await expect(page.getByRole('button', { name: /^(Siguiente|Next)$/ })).toBeVisible();
    await capture(page, testInfo, '04-correct');
    await page.getByRole('button', { name: /^(Siguiente|Next)$/ }).click();

    await page.getByRole('button', { name: 'Santiago' }).click();
    await confirm.click();
    await expect(page.getByRole('button', { name: /^(Siguiente|Next)$/ })).toBeVisible();
    await capture(page, testInfo, '05-incorrect');
    await page.getByRole('button', { name: /^(Siguiente|Next)$/ }).click();

    const map = page.locator('.map-surface');
    await expect(map).toBeVisible();
    await capture(page, testInfo, '06-map');
    await map.click({ position: { x: 140, y: 150 } });
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByRole('button', { name: /^(Siguiente|Next)$/ })).toBeVisible();
    await page.getByRole('button', { name: /^(Siguiente|Next)$/ }).click();

    await expect(page.getByRole('button', { name: 'Bogotá' })).toBeVisible();
    await capture(page, testInfo, '07-last-question');
  });
});
