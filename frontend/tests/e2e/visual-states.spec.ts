import { expect, type Page, test, type TestInfo } from '@playwright/test';
import { mockGameApis } from './helpers/gameApiMocks';

// Mobile visual checks (light + dark) for the neutral "locked" option state in
// Challenge, the Flash miss/hit feedback, and the Flash finish error + retry.
// Screenshots go to testInfo.outputPath(), i.e. the Playwright outputDir.

const FLAG_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><path fill="#fff" d="M0 0h300v200H0z"/><path fill="#d52b1e" d="M0 100h300v100H0z"/><path fill="#0039a6" d="M0 0h100v100H0z"/></svg>';

const themes = ['light', 'dark'] as const;

const challengeQuestions = [
  {
    id: 'ch-1', category: 'CAPITAL', questionText: '¿Cuál es la capital de Chile?', questionData: 'Chile',
    options: ['Santiago', 'Lima', 'Bogotá', 'Quito'], difficulty: 'MEDIUM',
  },
  {
    id: 'ch-2', category: 'CAPITAL', questionText: '¿Cuál es la capital de Perú?', questionData: 'Perú',
    options: ['Lima', 'Santiago', 'Bogotá', 'Quito'], difficulty: 'MEDIUM',
  },
];

const flashQuestions = [
  { id: 'fl-1', category: 'FLAG', questionText: '¿De qué país es esta bandera?', imageUrl: 'https://flagcdn.com/w320/cl.png', options: ['Chile', 'Argentina'], difficulty: 'EASY' },
  { id: 'fl-2', category: 'FLAG', questionText: '¿De qué país es esta bandera?', imageUrl: 'https://flagcdn.com/w320/ar.png', options: ['Perú', 'Argentina'], difficulty: 'EASY' },
  { id: 'fl-3', category: 'FLAG', questionText: '¿De qué país es esta bandera?', imageUrl: 'https://flagcdn.com/w320/br.png', options: ['Brasil', 'Uruguay'], difficulty: 'EASY' },
];
const flashCorrect: Record<string, string> = { 'fl-1': 'Chile', 'fl-2': 'Argentina', 'fl-3': 'Brasil' };

async function prepare(page: Page, theme: (typeof themes)[number]) {
  await mockGameApis(page);
  await page.addInitScript(() => localStorage.setItem('i18nextLng', 'es'));
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.route('https://flagcdn.com/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: FLAG_SVG }));
}

async function capture(page: Page, testInfo: TestInfo, theme: string, state: string) {
  const path = testInfo.outputPath(`${state}-${theme}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await testInfo.attach(`${state}-${theme}`, { path, contentType: 'image/png' });
}

async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

// Flash feedback lasts 320ms (hit) / 700ms (miss). Hold those timers until the
// test releases them so the screenshot does not race the window.
async function holdFlashFeedback(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __hold: boolean; __held: Array<() => void>; __release: () => void };
    w.__hold = false;
    w.__held = [];
    w.__release = () => {
      w.__hold = false;
      w.__held.splice(0).forEach((run) => run());
    };
    const original = window.setTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (w.__hold && (delay === 320 || delay === 700) && typeof handler === 'function') {
        const id = original(() => undefined, 0);
        w.__held.push(() => (handler as (...a: unknown[]) => void)(...args));
        return id;
      }
      return original(handler, delay, ...args);
    }) as typeof window.setTimeout;
  });
}

async function setHold(page: Page, hold: boolean) {
  await page.evaluate((value) => {
    const w = window as unknown as { __hold: boolean; __release: () => void };
    if (value) w.__hold = true;
    else w.__release();
  }, hold);
}

async function mockFlash(page: Page, finish: { status: number }) {
  await page.route('**/api/game/question-started', (route) => route.fulfill({ json: {} }));
  await page.route('**/api/game/flash/start**', (route) => route.fulfill({
    json: {
      sessionId: 'flash-session',
      gameConfig: { questionsCount: flashQuestions.length, timePerQuestion: 60, durationSeconds: 60, category: 'FLAG' },
      questions: flashQuestions.slice(0, 3),
    },
  }));
  await page.route('**/api/game/answer', (route) => {
    const { questionId, answer } = route.request().postDataJSON() as { questionId: string; answer: string };
    const correctAnswer = flashCorrect[questionId];
    const isCorrect = answer === correctAnswer;
    return route.fulfill({ json: { isCorrect, correctAnswer, points: isCorrect ? 10 : 0 } });
  });
  await page.route('**/api/game/finish', (route) => (finish.status === 200
    ? route.fulfill({ json: { totalScore: 10, score: 10, correctCount: 1, totalQuestions: 3, newAchievements: [] } })
    : route.fulfill({ status: finish.status, json: { error: 'boom' } })));
}

async function startFlash(page: Page) {
  await page.goto('/game/flash?category=FLAG');
  await page.getByRole('button', { name: '¡Empezar!' }).click();
  await expect(page.getByRole('button', { name: /Opción A/ })).toBeVisible();
}

for (const theme of themes) {
  test.describe(`Visual states, ${theme}`, () => {
    test('challenge: submitted answer shows the neutral locked state', async ({ page }, testInfo) => {
      await prepare(page, theme);
      await page.route('**/api/challenges/*/questions', (route) => route.fulfill({
        json: { questions: challengeQuestions, answerTimeSeconds: 60 },
      }));

      await page.goto('/challenges/e2e-challenge/play');
      await expect(page.getByRole('button', { name: /Santiago/ })).toBeVisible();
      await capture(page, testInfo, theme, 'challenge-1-initial');

      await page.getByRole('button', { name: /Santiago/ }).click();
      const tray = page.getByTestId('mobile-action-tray');
      const submit = tray.getByRole('button', { name: /^(Confirmar|Submit)$/ });
      await expect(submit).toBeEnabled();
      await submit.click();

      const submitted = page.locator('button[data-state="submitted"]');
      await expect(submitted).toHaveCount(1);
      await expect(submitted).toContainText('Santiago');
      await expect(submitted).toContainText(/^.*(Tu respuesta|Your answer)/s);
      await expect(submitted.getByText(/^(Respuesta enviada|Answer locked)$/)).toBeAttached();
      // Regression: the neutral tint and the letter badge must actually paint.
      await expect(submitted).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(submitted.locator('.option-button-index')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.locator('button[data-state="wrong"], button[data-state="correct"]')).toHaveCount(0);
      expect(await page.locator('body').textContent()).not.toMatch(/Incorrect[ao]?\b/);

      const counter = page.locator('header').getByLabel(/^(Pregunta|Question) 1 (de|of) 2$/);
      await expect(counter).toBeVisible();
      await expect(counter).toHaveText('1/2');
      await expect(tray.getByRole('button', { name: /^(Siguiente|Next)$/ })).toBeInViewport({ ratio: 1 });
      await expectNoHorizontalOverflow(page);
      await capture(page, testInfo, theme, 'challenge-2-locked');
    });

    test('flash: miss highlights the correct option, hit tints the card', async ({ page }, testInfo) => {
      await prepare(page, theme);
      await holdFlashFeedback(page);
      await mockFlash(page, { status: 200 });
      await startFlash(page);

      // Miss: Q1 answer is Chile, tap Argentina.
      await setHold(page, true);
      await page.getByRole('button', { name: /Argentina/ }).click();
      const correctOption = page.locator('button[data-correct="true"]');
      await expect(correctOption).toHaveCount(1);
      await expect(correctOption).toContainText('Chile');
      await expect(correctOption).toBeInViewport({ ratio: 1 });
      // Regression: the revealed answer must not be dimmed like the disabled option.
      await expect(correctOption).toHaveCSS('opacity', '1');
      await expect(correctOption).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await expect(page.locator('button:not([data-correct])').filter({ hasText: 'Argentina' })).toHaveCSS('opacity', '0.6');
      await expect(page.getByRole('img', { name: /Bandera|Flag/ }).first()).toHaveClass(/border-error-500/);
      await expectNoHorizontalOverflow(page);
      await capture(page, testInfo, theme, 'flash-1-miss');
      await setHold(page, false);

      // Hit: Q2 answer is Argentina.
      await expect(page.getByRole('button', { name: /Perú/ })).toBeVisible();
      await setHold(page, true);
      await page.getByRole('button', { name: /Argentina/ }).click();
      await expect(page.getByRole('img', { name: /Bandera|Flag/ }).first()).toHaveClass(/border-success-500/);
      await expect(page.locator('button[data-correct="true"]')).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await capture(page, testInfo, theme, 'flash-2-hit');
      await setHold(page, false);
      await expect(page.getByRole('button', { name: /Brasil/ })).toBeVisible();
    });

    test('flash: finish error offers Retry that recovers', async ({ page }, testInfo) => {
      const finish = { status: 500 };
      await prepare(page, theme);
      await mockFlash(page, finish);
      await startFlash(page);

      for (const [option, next] of [[/Chile/, /Argentina/], [/Argentina/, /Brasil/]] as const) {
        await page.getByRole('button', { name: option }).click();
        await expect(page.getByRole('button', { name: next })).toBeVisible();
      }
      await page.getByRole('button', { name: /Brasil/ }).click();

      const retry = page.getByRole('button', { name: /^(Reintentar|Retry)$/ });
      await expect(retry).toBeVisible();
      await expect(retry).toBeInViewport({ ratio: 1 });
      await expect(retry).toBeEnabled();
      await expect(page.getByRole('alert')).toContainText(/No se pudo guardar|couldn't save/);
      await expect(page.getByRole('button', { name: /^(Volver al menú|Back to Menu)$/ })).toBeInViewport({ ratio: 1 });
      await expectNoHorizontalOverflow(page);
      await capture(page, testInfo, theme, 'flash-3-finish-error');

      finish.status = 200;
      await page.unroute('**/api/game/finish');
      await page.route('**/api/game/finish', (route) => route.fulfill({
        json: { totalScore: 30, score: 30, correctCount: 3, totalQuestions: 3, newAchievements: [] },
      }));
      await retry.click();
      await expect(page.getByRole('heading', { name: /^(¡Flash terminado!|Flash finished!)$/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /^(Reintentar|Retry)$/ })).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await capture(page, testInfo, theme, 'flash-4-finished');
    });
  });
}
