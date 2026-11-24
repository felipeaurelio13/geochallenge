import { describe, expect, it } from 'vitest';
import { startGameSchema } from '../controllers/game.controller.js';
import { createChallengeSchema, submitResultSchema } from '../controllers/challenge.controller.js';
import { Category } from '../types/index.js';

describe('schema hardening and collection bounds (GHSA-mrhx-c7xc-m3w5 mitigation)', () => {
  describe('startGameSchema bounds', () => {
    it('accepts valid input with standard excludeIds', () => {
      const valid = startGameSchema.safeParse({
        category: Category.CAPITALS,
        questionCount: 10,
        excludeIds: ['q1', 'q2'],
      });
      expect(valid.success).toBe(true);
    });

    it('rejects oversized continent filter string (>50 chars)', () => {
      const result = startGameSchema.safeParse({
        continent: 'A'.repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it('rejects excludeIds item exceeding 100 characters', () => {
      const result = startGameSchema.safeParse({
        excludeIds: ['valid-id', 'A'.repeat(101)],
      });
      expect(result.success).toBe(false);
    });

    it('rejects excludeIds array exceeding 500 items', () => {
      const oversizedArray = Array.from({ length: 501 }, (_, i) => `id-${i}`);
      const result = startGameSchema.safeParse({
        excludeIds: oversizedArray,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createChallengeSchema bounds', () => {
    it('accepts valid categories within bounds', () => {
      const result = createChallengeSchema.safeParse({
        categories: [Category.FLAGS, Category.CAPITALS],
        maxPlayers: 4,
        answerTimeSeconds: 15, // Wait, refine is [10, 20, 30]
      });
      // 15 is not in [10, 20, 30]
      expect(result.success).toBe(false);

      const validResult = createChallengeSchema.safeParse({
        categories: [Category.FLAGS, Category.CAPITALS],
        maxPlayers: 4,
        answerTimeSeconds: 20,
      });
      expect(validResult.success).toBe(true);
    });

    it('rejects categories collection exceeding 10 items', () => {
      const oversizedCategories = Array.from({ length: 11 }, () => Category.CAPITALS);
      const result = createChallengeSchema.safeParse({
        categories: oversizedCategories,
        maxPlayers: 4,
        answerTimeSeconds: 20,
      });
      expect(result.success).toBe(false);
    });

    it('rejects oversized continent filter (>50 chars)', () => {
      const result = createChallengeSchema.safeParse({
        categories: [Category.CAPITALS],
        maxPlayers: 4,
        answerTimeSeconds: 20,
        filters: {
          continent: 'Europe'.repeat(10),
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('submitResultSchema bounds', () => {
    it('accepts valid answers within collection and length limits', () => {
      const result = submitResultSchema.safeParse({
        answers: [
          {
            questionId: 'q-1',
            answer: 'Paris',
            timeRemaining: 15,
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('rejects answers collection exceeding 20 items', () => {
      const oversizedAnswers = Array.from({ length: 21 }, (_, i) => ({
        questionId: `q-${i}`,
        answer: 'Test',
        timeRemaining: 10,
      }));
      const result = submitResultSchema.safeParse({
        answers: oversizedAnswers,
      });
      expect(result.success).toBe(false);
    });

    it('rejects questionId exceeding 64 characters', () => {
      const result = submitResultSchema.safeParse({
        answers: [
          {
            questionId: 'Q'.repeat(65),
            answer: 'Valid',
            timeRemaining: 10,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('rejects answer exceeding 200 characters', () => {
      const result = submitResultSchema.safeParse({
        answers: [
          {
            questionId: 'q-valid',
            answer: 'A'.repeat(201),
            timeRemaining: 10,
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });
});
