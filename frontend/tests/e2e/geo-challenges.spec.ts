import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

const rounds = [
  {
    id: 'r1',
    kind: 'EXTREME',
    region: 'AMERICAS',
    difficulty: 'MEDIUM',
    selectionMode: 'single',
    prompt: { es: '¿Cuál tiene la capital más al sur?', en: 'Which has the southernmost capital?' },
    instruction: { es: 'Elige un país.', en: 'Choose one country.' },
    options: [
      { id: 'CL', label: { es: 'Chile', en: 'Chile' } },
      { id: 'AR', label: { es: 'Argentina', en: 'Argentina' } },
      { id: 'PE', label: { es: 'Perú', en: 'Peru' } },
      { id: 'EC', label: { es: 'Ecuador', en: 'Ecuador' } },
    ],
  },
  ...(['HIGHER_LOWER', 'COMMON_NEIGHBOR', 'ODD_ONE_OUT'] as const).map((kind, index) => ({
    id: `r${index + 2}`,
    kind,
    region: (['AFRICA', 'ASIA', 'EUROPE'] as const)[index],
    difficulty: 'MEDIUM' as const,
    selectionMode: 'single' as const,
    prompt: { es: `Pregunta ${index + 2}`, en: `Question ${index + 2}` },
    instruction: { es: 'Elige un país.', en: 'Choose one country.' },
    options: [
      { id: 'BR', label: { es: 'Brasil', en: 'Brazil' } },
      { id: 'BO', label: { es: 'Bolivia', en: 'Bolivia' } },
    ],
  })),
  {
    id: 'r5',
    kind: 'NORTH_TO_SOUTH',
    region: 'OCEANIA',
    difficulty: 'HARD',
    selectionMode: 'ordered',
    prompt: { es: 'Ordena de norte a sur.', en: 'Order from north to south.' },
    instruction: { es: 'Tócalos en orden.', en: 'Tap them in order.' },
    options: [
      { id: 'CA', label: { es: 'Canadá', en: 'Canada' } },
      { id: 'US', label: { es: 'Estados Unidos', en: 'United States' } },
      { id: 'MX', label: { es: 'México', en: 'Mexico' } },
      { id: 'GT', label: { es: 'Guatemala', en: 'Guatemala' } },
    ],
  },
];

async function mockGeoChallengeApis(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'e2e-token');
  });

  for (const healthPath of ['**/health', '**/ping']) {
    await page.route(healthPath, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
  }

  await page.route('**/api/auth/me', async (route: Route) => {
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

  await page.route('**/api/game/geo-challenges/start', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        gameId: 'e2e-game',
        sessionToken: 'signed-session',
        timePerRound: 300,
        dataVersion: 'v1',
        dataUpdatedAt: '2026-08-01',
        rounds,
      }),
    });
  });

}

test.describe('GeoRetos mobile', () => {
  test.beforeEach(async ({ page }) => {
    await mockGeoChallengeApis(page);
  });

  test('keeps all options and the primary action reachable', async ({ page }) => {
    await page.goto('/geo-challenges');
    await page.getByRole('button', { name: /Comenzar la vuelta al mundo|Start the world tour/ }).click();

    const confirmButton = page.getByRole('button', { name: /Confirmar respuesta|Confirm answer/ });
    await expect(confirmButton).toBeVisible();
    await expect(confirmButton).toBeDisabled();

    const options = page.locator('#geo-challenge-options button');
    await expect(options).toHaveCount(4);
    await options.last().scrollIntoViewIfNeeded();
    await expect(options.last()).toBeInViewport();

    await page.getByRole('button', { name: 'Chile' }).click();
    await expect(confirmButton).toBeEnabled();
  });

  test('offers the 10-question duel from the briefing', async ({ page }) => {
    await page.goto('/geo-challenges');

    const duelButton = page.getByRole('button', { name: /duelo de 10 preguntas|10-question duel/i });
    await expect(duelButton).toBeVisible();
    await duelButton.click();

    await expect(page).toHaveURL(/\/duel\?mode=geo-challenge$/);
  });

  test('has no accidental horizontal overflow in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/geo-challenges');
    await page.getByRole('button', { name: /Comenzar la vuelta al mundo|Start the world tour/ }).click();

    await expect(page.getByRole('button', { name: /Confirmar respuesta|Confirm answer/ })).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasHorizontalOverflow).toBeFalsy();

    await expect(page).toHaveScreenshot('geo-challenge-round-dark.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      mask: [page.getByRole('timer')],
      maxDiffPixelRatio: 0.01,
    });
  });
});
