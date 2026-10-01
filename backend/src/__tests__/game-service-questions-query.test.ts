import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Category } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  prisma: { question: { findMany: mocks.findMany } },
}));

import { getQuestionsForGame } from '../services/game.service.js';

function row(id: string, category: Category) {
  return {
    id,
    category,
    questionData: `data-${id}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'A',
    difficulty: null,
    imageUrl: null,
    latitude: null,
    longitude: null,
    continent: null,
    subregion: null,
    isInsular: null,
    isLandlocked: null,
    populationTier: null,
    areaTier: null,
    countryCode: null,
  };
}

describe('getQuestionsForGame — una sola query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([row('q1', Category.FLAG), row('q2', Category.CAPITAL)]);
  });

  it('MIXED hace una sola findMany limitada a las categorías jugables', async () => {
    const result = await getQuestionsForGame(Category.MIXED, 2, ['skip-me']);

    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.category).toEqual({
      in: [Category.FLAG, Category.CAPITAL, Category.MAP, Category.SILHOUETTE, Category.MONUMENT],
    });
    expect(where.id).toEqual({ notIn: ['skip-me'] });
    expect(where.isAvailable).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('sin categoría se comporta como MIXED (una query)', async () => {
    await getQuestionsForGame(undefined, 2);
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.findMany.mock.calls[0][0].where.category).toEqual({ in: expect.any(Array) });
  });

  it('categoría concreta filtra por esa categoría (una query)', async () => {
    await getQuestionsForGame(Category.FLAG, 2, [], { continent: 'Europe' });
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    const where = mocks.findMany.mock.calls[0][0].where;
    expect(where.category).toBe(Category.FLAG);
    expect(where.continent).toBe('Europe');
  });
});
