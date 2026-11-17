import { describe, expect, it } from 'vitest';
import { startGameSchema } from '../controllers/game.controller.js';
import { createChallengeSchema, submitResultSchema } from '../controllers/challenge.controller.js';

describe('schema hardening: oversized collections & payload limits (defense-in-depth)', () => {
  describe('startGameSchema', () => {
    it('accepts valid input with reasonable excludeIds', () => {
      const res = startGameSchema.safeParse({
        category: 'MIXED',
        questionCount: 10,
        excludeIds: ['q1', 'q2'],
        continent: 'Europe',
      });
      expect(res.success).toBe(true);
    });

    it('rejects oversized excludeIds collections (> 500 items)', () => {
      const oversized = Array.from({ length: 501 }, (_, i) => `id-${i}`);
      const res = startGameSchema.safeParse({
        excludeIds: oversized,
      });
      expect(res.success).toBe(false);
    });

    it('rejects oversized individual excludeIds strings (> 100 chars)', () => {
      const res = startGameSchema.safeParse({
        excludeIds: ['a'.repeat(101)],
      });
      expect(res.success).toBe(false);
    });

    it('rejects oversized continent filter (> 50 chars)', () => {
      const res = startGameSchema.safeParse({
        continent: 'X'.repeat(51),
      });
      expect(res.success).toBe(false);
    });
  });

  describe('createChallengeSchema', () => {
    it('accepts valid challenge creation payload', () => {
      const res = createChallengeSchema.safeParse({
        categories: ['CAPITAL'],
        maxPlayers: 4,
        answerTimeSeconds: 20,
        filters: { continent: 'Americas' },
      });
      expect(res.success).toBe(true);
    });

    it('rejects oversized category collections (> 10 categories)', () => {
      const oversized = Array.from({ length: 11 }, () => 'CAPITAL');
      const res = createChallengeSchema.safeParse({
        categories: oversized,
        maxPlayers: 4,
        answerTimeSeconds: 20,
      });
      expect(res.success).toBe(false);
    });

    it('rejects empty categories list', () => {
      const res = createChallengeSchema.safeParse({
        categories: [],
        maxPlayers: 4,
        answerTimeSeconds: 20,
      });
      expect(res.success).toBe(false);
    });

    it('rejects oversized continent filter (> 50 chars)', () => {
      const res = createChallengeSchema.safeParse({
        categories: ['FLAG'],
        maxPlayers: 4,
        answerTimeSeconds: 20,
        filters: { continent: 'A'.repeat(51) },
      });
      expect(res.success).toBe(false);
    });
  });

  describe('submitResultSchema', () => {
    it('accepts normal submission array', () => {
      const res = submitResultSchema.safeParse({
        answers: [
          { questionId: 'q1', answer: 'Paris', timeRemaining: 15 },
        ],
      });
      expect(res.success).toBe(true);
    });

    it('rejects submission with > 20 answers', () => {
      const oversized = Array.from({ length: 21 }, (_, i) => ({
        questionId: `q${i}`,
        answer: 'Ans',
        timeRemaining: 10,
      }));
      const res = submitResultSchema.safeParse({ answers: oversized });
      expect(res.success).toBe(false);
    });

    it('rejects answer strings > 200 chars', () => {
      const res = submitResultSchema.safeParse({
        answers: [
          { questionId: 'q1', answer: 'x'.repeat(201), timeRemaining: 10 },
        ],
      });
      expect(res.success).toBe(false);
    });

    it('rejects questionId strings > 64 chars', () => {
      const res = submitResultSchema.safeParse({
        answers: [
          { questionId: 'q'.repeat(65), answer: 'Paris', timeRemaining: 10 },
        ],
      });
      expect(res.success).toBe(false);
    });
  });
});
