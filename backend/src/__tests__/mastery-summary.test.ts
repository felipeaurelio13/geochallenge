import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Category } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  masteryAttemptFindMany: vi.fn(),
  questionFindMany: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  prisma: {
    masteryAttempt: { findMany: mocks.masteryAttemptFindMany },
    question: { findMany: mocks.questionFindMany },
  },
}));

vi.mock('../utils/countryCatalog.js', () => ({
  loadCountryCatalog: () => [],
  getActiveCountries: () => [],
}));

import { getMasterySummary } from '../services/mastery.service.js';

const playableCountries = Array.from({ length: 197 }, (_, index) => `C${String(index).padStart(3, '0')}`);

describe('getMasterySummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.questionFindMany.mockResolvedValue(
      playableCountries.map((countryCode) => ({ countryCode, category: Category.FLAG }))
    );
  });

  it('reports explored countries separately from mastered countries', async () => {
    const attempts = playableCountries.slice(0, 32).flatMap((countryCode, index) =>
      Array.from({ length: index < 3 ? 8 : 1 }, (_, attempt) => ({
        countryCode,
        category: Category.FLAG,
        isCorrect: true,
        occurredAt: new Date(2026, 0, attempt + 1),
      }))
    );
    mocks.masteryAttemptFindMany.mockResolvedValue(attempts);

    const summary = await getMasterySummary('user-1');

    expect(summary.worldProgressPercent).toBe(16.2);
    expect(summary.stampedCountries).toBe(32);
    expect(summary.masteredCountries).toBe(3);
  });

  it('returns 0% with no stamped country while keeping mastery independent', async () => {
    mocks.masteryAttemptFindMany.mockResolvedValue([]);

    const summary = await getMasterySummary('user-1');

    expect(summary.worldProgressPercent).toBe(0);
    expect(summary.stampedCountries).toBe(0);
    expect(summary.masteredCountries).toBe(0);
  });
});
