import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Category } from '@prisma/client';
import { startGameSchema } from '../controllers/game.controller';

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  prisma: {
    question: {
      findMany: findManyMock,
    },
  },
}));

vi.mock('../utils/scoring.js', () => ({
  calculateScore: vi.fn(),
  calculateMapScore: vi.fn(),
  shuffleArray: <T>(values: T[]) => values,
  selectRandom: <T>(values: T[], count: number) => values.slice(0, count),
}));

describe('startGameSchema', () => {
  it('mantiene compatibilidad con gameType por default single', () => {
    const parsed = startGameSchema.parse({
      questionCount: 10,
    });

    expect(parsed.gameType).toBe('single');
  });

  it('normaliza excludeIds desde query string csv', () => {
    const parsed = startGameSchema.parse({
      gameType: 'streak',
      excludeIds: 'q1, q2,,q3',
    });

    expect(parsed.excludeIds).toEqual(['q1', 'q2', 'q3']);
  });
});

describe('getQuestionsForStreakGame', () => {
  beforeEach(() => {
    findManyMock.mockReset();
  });

  it('reutiliza getQuestionsForGame y respeta excludeIds para evitar repetidas inmediatas', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'q1',
        category: Category.FLAG,
        questionData: 'Argentina',
        options: ['Argentina', 'Chile', 'Perú', 'Brasil'],
        correctAnswer: 'Argentina',
        difficulty: 'EASY',
        imageUrl: null,
      },
      {
        id: 'q2',
        category: Category.FLAG,
        questionData: 'Brasil',
        options: ['Argentina', 'Chile', 'Perú', 'Brasil'],
        correctAnswer: 'Brasil',
        difficulty: 'EASY',
        imageUrl: null,
      },
    ]);

    const { getQuestionsForStreakGame } = await import('../services/game.service.js');
    const questions = await getQuestionsForStreakGame(Category.FLAG, ['q1'], 10);

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        category: Category.FLAG,
        id: { notIn: ['q1'] },
      },
    });
    expect(questions).toHaveLength(2);
  });
});
