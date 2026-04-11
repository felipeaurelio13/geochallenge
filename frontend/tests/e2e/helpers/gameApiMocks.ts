import type { Page } from '@playwright/test';

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

export async function mockGameApis(page: Page) {
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
