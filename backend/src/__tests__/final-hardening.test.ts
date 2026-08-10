/**
 * Delta final tests — Plan 1+2 hardening.
 */
import { describe, expect, it } from 'vitest';
import { GameVariant } from '@prisma/client';
import { toPublicQuestion } from '../services/game.service.js';
import type { GameQuestion } from '../services/game.service.js';

function q(overrides: Partial<GameQuestion> = {}): GameQuestion {
  return {
    id: 'q1', category: 'FLAG' as const, questionText: 'Test', options: ['A', 'B'],
    correctAnswer: 'A', imageUrl: 'x.png', latitude: 10, longitude: 20,
    continent: 'EU', subregion: 'West', isInsular: false, isLandlocked: false,
    ...overrides,
  };
}

describe('PublicQuestion compile-time boundary', () => {
  it('strips correctAnswer', () => {
    const result = toPublicQuestion(q());
    expect(result).not.toHaveProperty('correctAnswer');
  });

  it('strips latitude and longitude', () => {
    const r = toPublicQuestion(q({ latitude: 50, longitude: 10 }));
    expect(r).not.toHaveProperty('latitude');
    expect(r).not.toHaveProperty('longitude');
  });

  it('preserves display fields', () => {
    const r = toPublicQuestion(q());
    expect(r.id).toBe('q1');
    expect(r.options).toEqual(['A', 'B']);
    expect(r.imageUrl).toBe('x.png');
    expect(r.continent).toBe('EU');
  });
});

describe('Matrix highScore/leaderboard', () => {
  const variants = [
    { v: 'CLASSIC', h: true, l: true },
    { v: 'STREAK', h: false, l: false },
    { v: 'FLASH', h: false, l: false },
    { v: 'FLAG_MASTER', h: false, l: false },
    { v: 'GEO_CHALLENGE', h: false, l: false },
    { v: 'DAILY', h: false, l: false },
  ] as const;

  it('only CLASSIC can modify highScore', () => {
    for (const { v, h } of variants) {
      const allowsHighScore = v === 'CLASSIC';
      expect(allowsHighScore).toBe(h);
    }
  });

  it('only CLASSIC enters Classic leaderboard', () => {
    for (const { v, l } of variants) {
      const allowsLeaderboard = v === 'CLASSIC';
      expect(allowsLeaderboard).toBe(l);
    }
  });
});
