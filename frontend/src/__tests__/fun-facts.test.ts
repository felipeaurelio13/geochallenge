import { describe, expect, it } from 'vitest';
import { generateFunFact } from '../utils/funFacts';
import type { Question } from '../types';

function question(overrides: Partial<Question>): Question {
  return {
    id: 'q1',
    category: 'FLAG',
    questionText: 'Which country does this flag belong to?',
    options: ['Chile', 'Peru', 'Bolivia', 'Argentina'],
    ...overrides,
  };
}

describe('generateFunFact', () => {
  it('generates a Spanish fact for a flag using its country metadata', () => {
    const fact = generateFunFact(
      question({
        category: 'FLAG',
        questionData: 'Chile',
        subregion: 'South America',
      }),
      'es',
    );

    expect(fact).toBe('Chile se encuentra en América del Sur.');
  });

  it('generates an English fact for a silhouette using its country metadata', () => {
    const fact = generateFunFact(
      question({
        category: 'SILHOUETTE',
        questionData: 'Chile',
        subregion: 'South America',
        isInsular: false,
        isLandlocked: false,
      }),
      'en',
    );

    expect(fact).toBe('Chile is located in South America.');
  });

  it('falls back to the revealed country when questionData is only an ISO code', () => {
    const fact = generateFunFact(
      question({
        category: 'FLAG',
        questionData: 'CL',
        subregion: 'South America',
      }),
      'es',
      'Chile',
    );

    expect(fact).toBe('Chile se encuentra en América del Sur.');
  });

  it('mentions insularity for island flags', () => {
    const fact = generateFunFact(
      question({
        category: 'FLAG',
        questionData: 'Japan',
        continent: 'Asia',
        isInsular: true,
      }),
      'en',
    );

    expect(fact).toBe('Japan is an island nation in Asia.');
  });

  it('keeps monuments out of the generic fact generator', () => {
    const fact = generateFunFact(
      question({
        category: 'MONUMENT',
        questionData: JSON.stringify({ slug: 'eiffel-tower', variant: 'identify' }),
      }),
      'es',
    );

    expect(fact).toBeNull();
  });

  it('returns null when there is no usable country context', () => {
    const fact = generateFunFact(question({ category: 'FLAG', questionData: undefined }), 'es');
    expect(fact).toBeNull();
  });
});
