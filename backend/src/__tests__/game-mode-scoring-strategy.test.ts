import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Category } from '@prisma/client';

const { findUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  prisma: {
    question: {
      findUnique: findUniqueMock,
    },
  },
}));

const calculateScoreMock = vi.fn();
const calculateMapScoreMock = vi.fn();

vi.mock('../utils/scoring.js', () => ({
  calculateScore: calculateScoreMock,
  calculateMapScore: calculateMapScoreMock,
  shuffleArray: <T>(values: T[]) => values,
  selectRandom: <T>(values: T[], count: number) => values.slice(0, count),
}));

describe('validateAnswerByGameType', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    calculateScoreMock.mockReset();
    calculateMapScoreMock.mockReset();
  });

  it('mantiene puntaje original en single', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'q-1',
      category: Category.FLAG,
      correctAnswer: 'Argentina',
    });
    calculateScoreMock.mockReturnValue(123);

    const { validateAnswerByGameType } = await import('../services/game.service.js');
    const result = await validateAnswerByGameType('q-1', 'Argentina', 7, undefined, 'single');

    expect(result.isCorrect).toBe(true);
    expect(result.points).toBe(123);
    expect(calculateScoreMock).toHaveBeenCalledWith(true, 7);
  });

  it('aplica 1/0 en streak sin alterar trazabilidad de respuesta', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'q-2',
      category: Category.CAPITAL,
      correctAnswer: 'Lima',
    });
    calculateScoreMock.mockReturnValue(88);

    const { validateAnswerByGameType } = await import('../services/game.service.js');

    const correct = await validateAnswerByGameType('q-2', 'Lima', 5, undefined, 'streak');
    const incorrect = await validateAnswerByGameType('q-2', 'Bogotá', 5, undefined, 'streak');

    expect(correct.points).toBe(1);
    expect(correct.isCorrect).toBe(true);
    expect(incorrect.points).toBe(0);
    expect(incorrect.isCorrect).toBe(false);
    expect(correct.timeRemaining).toBe(5);
    expect(correct.correctAnswer).toBe('Lima');
  });

  it('diferencia estrategia de scoring entre single y streak para la misma respuesta correcta', async () => {
    findUniqueMock.mockResolvedValue({
      id: 'q-3',
      category: Category.CAPITAL,
      correctAnswer: 'Quito',
    });
    calculateScoreMock.mockReturnValue(140);

    const { validateAnswerByGameType } = await import('../services/game.service.js');

    const singleResult = await validateAnswerByGameType('q-3', 'Quito', 9, undefined, 'single');
    const streakResult = await validateAnswerByGameType('q-3', 'Quito', 9, undefined, 'streak');

    expect(singleResult.points).toBe(140);
    expect(streakResult.points).toBe(1);
    expect(singleResult.isCorrect).toBe(true);
    expect(streakResult.isCorrect).toBe(true);
  });
});
