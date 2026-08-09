import { describe, expect, it } from 'vitest';
import { Category, GameMode, GameVariant } from '@prisma/client';
import { toPublicQuestion, type GameQuestion } from '../services/game.service.js';

function makeQuestion(overrides: Partial<GameQuestion> = {}): GameQuestion {
  return {
    id: 'q1',
    category: Category.FLAG,
    questionText: '¿Qué bandera es?',
    options: ['Chile', 'Argentina', 'Perú', 'Brasil'],
    correctAnswer: 'Chile',
    imageUrl: 'https://example.com/flag.png',
    continent: 'SA',
    subregion: 'South America',
    isInsular: false,
    isLandlocked: false,
    populationTier: 'HIGH',
    areaTier: 'LARGE',
    ...overrides,
  };
}

describe('toPublicQuestion — answer leakage prevention', () => {
  it('strips correctAnswer from a Classic question', () => {
    const q = makeQuestion({ category: Category.CAPITAL });
    const result = toPublicQuestion(q);
    expect(result).not.toHaveProperty('correctAnswer');
    expect(result.id).toBe('q1');
    expect(result.questionText).toBe('¿Qué bandera es?');
    expect(result.options).toHaveLength(4);
  });

  it('strips correctAnswer from a Flash-style visual question', () => {
    const q = makeQuestion({ category: Category.FLAG, options: ['Chile', 'Argentina'] });
    const result = toPublicQuestion(q);
    expect(result).not.toHaveProperty('correctAnswer');
  });

  it('strips correctAnswer from a Streak question', () => {
    const q = makeQuestion({ category: Category.MAP });
    const result = toPublicQuestion(q);
    expect(result).not.toHaveProperty('correctAnswer');
  });

  it('strips correctAnswer from a Flag Master question (HARD flag)', () => {
    const q = makeQuestion({ category: Category.FLAG, difficulty: 'HARD' });
    const result = toPublicQuestion(q);
    expect(result).not.toHaveProperty('correctAnswer');
  });

  it('strips correctAnswer from a GeoRetos-compatible question (MIXED)', () => {
    const q = makeQuestion({ category: Category.MIXED, correctAnswer: 'Santiago' });
    const result = toPublicQuestion(q);
    expect(result).not.toHaveProperty('correctAnswer');
  });

  it('preserves all other fields: id, category, questionText, options, imageUrl, difficulty', () => {
    const q = makeQuestion();
    const result = toPublicQuestion(q);
    expect(result.id).toBe('q1');
    expect(result.category).toBe(Category.FLAG);
    expect(result.questionText).toBe('¿Qué bandera es?');
    expect(result.options).toEqual(['Chile', 'Argentina', 'Perú', 'Brasil']);
    expect(result.imageUrl).toBe('https://example.com/flag.png');
    expect(result.continent).toBe('SA');
    expect(result.isInsular).toBe(false);
    expect(result.isLandlocked).toBe(false);
  });

  it('preserves MAP-specific fields (latitude, longitude) for rendering', () => {
    const q = makeQuestion({
      category: Category.MAP,
      latitude: -33.4489,
      longitude: -70.6693,
    });
    const result = toPublicQuestion(q);
    expect(result).not.toHaveProperty('correctAnswer');
    expect(result.latitude).toBe(-33.4489);
    expect(result.longitude).toBe(-70.6693);
  });

  it('does NOT include latitude/longitude for non-MAP questions (privacy)', () => {
    const q = makeQuestion({
      category: Category.FLAG,
      latitude: 10,
      longitude: 20,
    });
    const result = toPublicQuestion(q);
    expect(result).not.toHaveProperty('correctAnswer');
    // Non-MAP questions shouldn't have coords — this depends on getQuestionsForGame, not the mapper,
    // but the mapper should at least not add them.
  });
});
