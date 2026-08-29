import { test, expect } from '@playwright/test';
import { mockGameApis } from './helpers/gameApiMocks';

const questions = [
  {
    id: 'capital-1',
    category: 'CAPITAL',
    questionText: '¿Cuál es la capital de Chile?',
    options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
    correctAnswer: 'Santiago',
    difficulty: 'MEDIUM',
  },
  {
    id: 'capital-2',
    category: 'CAPITAL',
    questionText: '¿Cuál es la capital de Perú?',
    options: ['Lima', 'Santiago', 'Bogotá', 'Quito'],
    correctAnswer: 'Lima',
    difficulty: 'MEDIUM',
  },
  {
    id: 'capital-3',
    category: 'CAPITAL',
    questionText: '¿Cuál es la capital de Ecuador?',
    options: ['Quito', 'Lima', 'Bogotá', 'Santiago'],
    correctAnswer: 'Quito',
    difficulty: 'MEDIUM',
  },
  {
    id: 'capital-4',
    category: 'CAPITAL',
    questionText: '¿Cuál es la capital de Colombia?',
    options: ['Bogotá', 'Lima', 'Quito', 'Santiago'],
    correctAnswer: 'Bogotá',
    difficulty: 'MEDIUM',
  },
  {
    id: 'map-5',
    category: 'MAP',
    questionText: 'Selecciona Chile en el mapa',
    options: [],
    correctAnswer: 'Chile',
    difficulty: 'MEDIUM',
  },
];

test.describe('partida MIXED que transiciona a MAP', () => {
  test.beforeEach(async ({ page }) => {
    await mockGameApis(page);

    await page.route('**/api/game/start**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          gameConfig: {
            questionsCount: questions.length,
            timePerQuestion: 30,
            category: 'MIXED',
          },
          questions,
        }),
      });
    });

    await page.route('**/api/game/answer', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isCorrect: true,
          correctAnswer: 'Chile',
          points: 100,
          timeBonus: 10,
          correctLocation: { lat: -33.45, lng: -70.67 },
        }),
      });
    });
  });

  test('en WebKit/iPhone avanza cinco rondas, incluida una transición normal a MAP, sin ErrorBoundary', async ({ page }) => {
    await page.goto('/game/single?category=MIXED');

    for (const answer of ['Santiago', 'Lima', 'Quito', 'Bogotá']) {
      await page.getByRole('button', { name: answer }).click();
      await page.getByRole('button', { name: /^(Confirmar|Submit)$/ }).click();
      await page.getByRole('button', { name: /^(Siguiente|Next)$/ }).click();
    }

    await expect(page.locator('.map-surface')).toBeVisible();
    await page.locator('.map-surface').press('Enter');
    await page.getByRole('button', { name: /^(Confirmar|Submit)$/ }).click();

    await expect(page.getByText(/^(Ha ocurrido un error inesperado|An unexpected error occurred)$/)).toHaveCount(0);
  });
});
