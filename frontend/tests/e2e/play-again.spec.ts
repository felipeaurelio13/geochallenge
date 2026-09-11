import { expect, test, type Page } from '@playwright/test';

type Calls = { starts: URL[]; finishes: number; ranks: number; availability: number };

async function fixture(page: Page, authenticated = false) {
  const calls: Calls = { starts: [], finishes: 0, ranks: 0, availability: 0 };
  if (authenticated) await page.addInitScript(() => localStorage.setItem('token', 'e2e-token'));
  const summary = { worldProgressPercent: 0, totalCountries: 180, stampedCountries: 0, masteredCountries: 0, skills: [] };
  const questions = Array.from({ length: 5 }, (_, i) => ({
    id: `trial-${i}`, category: 'FLAG', questionText: '¿A qué país pertenece esta bandera?',
    imageUrl: 'https://flagcdn.com/w320/cl.png', options: ['Chile', 'Argentina', 'Perú', 'Brasil'], difficulty: 'EASY',
  }));
  await page.route('https://flagcdn.com/**', (route) => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><path fill="#fff" d="M0 0h300v200H0z"/><path fill="#d52b1e" d="M0 100h300v100H0z"/><path fill="#0039a6" d="M0 0h100v100H0z"/><path fill="#fff" d="m50 20 7 22h23L61 55l7 23-18-14-18 14 7-23-19-13h23z"/></svg>',
  }));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body: unknown = {};
    if (path.endsWith('/auth/me')) body = { user: { id: 'e2e-user', username: 'Explorer', preferredLanguage: 'es', gamesPlayed: 0, highScore: 0, wins: 0, losses: 0 } };
    else if (path.endsWith('/game/start') || path.endsWith('/mastery/practice/start')) {
      calls.starts.push(url);
      body = { sessionId: `session-${calls.starts.length}`, questions, gameConfig: { questionsCount: 5, timePerQuestion: 10, category: url.searchParams.get('category') ?? 'MIXED', gameType: path.endsWith('/mastery/practice/start') ? 'practice' : url.searchParams.get('gameType') ?? 'single' } };
    } else if (path.endsWith('/game/answer')) {
      const answer = route.request().postDataJSON().answer;
      body = { isCorrect: answer === 'Chile', correctAnswer: 'Chile', points: answer === 'Chile' ? 100 : 0, basePoints: answer === 'Chile' ? 100 : 0 };
    } else if (path.endsWith('/game/finish')) {
      calls.finishes += 1;
      body = { score: 400, correctCount: 4, totalQuestions: 5, newAchievements: [] };
    } else if (path.endsWith('/leaderboard/me')) { calls.ranks += 1; body = { userRank: { rank: 7 } }; }
    else if (path.endsWith('/mastery/summary')) body = summary;
    else if (path.endsWith('/mastery/passport')) body = { summary, countries: [] };
    else if (path.endsWith('/game/availability')) { calls.availability += 1; body = { canPlay: true, required: 10, available: 50 }; }
    else if (path.endsWith('/daily/status')) body = { completed: false, dailyStreak: 0 };
    else if (path.includes('/event')) body = null;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  for (const path of ['**/health', '**/ping']) await page.route(path, (route) => route.fulfill({ json: { status: 'healthy' } }));
  return calls;
}

async function completeGame(page: Page) {
  for (let i = 0; i < 5; i++) {
    const options = page.locator('.game-options-wrap button');
    await expect(options).toHaveCount(4);
    await expect(options.last()).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: i === 1 ? /Argentina/ : /Chile/ }).click();
    const tray = page.getByTestId('mobile-action-tray');
    const submit = tray.getByRole('button', { name: /^(Confirmar|Submit)$/ });
    await expect(submit).toBeInViewport({ ratio: 1 });
    await submit.click();
    await tray.getByRole('button', { name: /^(Siguiente|Next|Ver resultados|See Results)$/i }).click();
  }
}

for (const language of ['es', 'en']) {
  for (const theme of ['light', 'dark'] as const) {
    test(`trial → review → replay, ${language}, ${theme}`, async ({ page }, testInfo) => {
      const calls = await fixture(page);
      await page.addInitScript((lng) => localStorage.setItem('i18nextLng', lng), language);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/');
      const start = page.getByRole('link', { name: /^(Probar una partida|Try a game)$/ });
      await expect(start).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: testInfo.outputPath('home.png') });
      await start.click();
      await expect(page).toHaveURL(/\/play$/);
      await expect(page.locator('.screen-footer')).toHaveCount(0);
      await completeGame(page);
      await expect(page).toHaveURL(/\/play\/results$/);
      await expect(page.getByText('4 / 5', { exact: true })).toBeVisible();
      const replay = page.getByTestId('results-action-tray').getByRole('button').first();
      await expect(replay).toBeInViewport({ ratio: 1 });
      expect(calls.finishes).toBe(0);
      expect(calls.ranks).toBe(0);
      expect(calls.starts[0].searchParams.get('questionCount')).toBe('5');
      expect(calls.starts[0].searchParams.get('difficulty')).toBe('EASY');
      await page.screenshot({ path: testInfo.outputPath('results.png') });
      const review = page.locator('details').first();
      await review.locator('summary').click();
      await expect(review.getByText('Argentina', { exact: true })).toBeVisible();
      await expect(review.locator('img')).toBeVisible();
      await expect(page.getByText('game.correctAnswer', { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await replay.click();
      await expect(page).toHaveURL(/\/play$/);
      await expect(page.getByRole('button', { name: /Chile/ })).toBeEnabled();
      expect(calls.starts).toHaveLength(2);
      expect(calls.finishes).toBe(0);
    });
  }
}

test('authenticated replay saves once and preserves category and filters', async ({ page }) => {
  const calls = await fixture(page, true);
  await page.goto('/game/single?category=FLAG&continent=South+America&difficulty=EASY&isInsular=true');
  await completeGame(page);
  await expect(page).toHaveURL(/\/results\?/);
  expect(calls.finishes).toBe(1);
  await page.getByTestId('results-action-tray').getByRole('button').first().click();
  await expect(page.getByRole('button', { name: /Chile/ })).toBeEnabled();
  expect(calls.starts).toHaveLength(2);
  for (const key of ['category', 'continent', 'difficulty', 'isInsular']) {
    expect(calls.starts[1].searchParams.get(key)).toBe(calls.starts[0].searchParams.get(key));
  }
});

test('authenticated users are redirected away from the guest trial without starting it', async ({ page }) => {
  const calls = await fixture(page, true);
  await page.goto('/play');
  await expect(page).toHaveURL(/\/menu$/);
  expect(calls.starts).toHaveLength(0);
});

test('empty passport offers a playable exit and menu does not probe hidden filters', async ({ page }) => {
  const calls = await fixture(page, true);
  await page.goto('/passport');
  await page.getByRole('button', { name: /^(Empezar a explorar|Start exploring)$/ }).click();
  await expect(page).toHaveURL(/gameType=practice/);
  await expect(page.getByRole('button', { name: /Chile/ })).toBeEnabled();
  await page.goto('/menu');
  const header = page.locator('header').first();
  const brand = await header.getByRole('link').first().boundingBox();
  const actions = await header.locator('div.shrink-0').boundingBox();
  expect(brand!.x + brand!.width).toBeLessThanOrEqual(actions!.x);
  await page.getByRole('button', { name: /Practicar|Practice/ }).first().click();
  await expect.poll(() => calls.availability).toBe(1);
  await page.getByRole('button', { name: /Abrir filtros|Open question filters/ }).click();
  await expect.poll(() => calls.availability).toBeGreaterThan(2);
});
