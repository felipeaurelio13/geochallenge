import { describe, it, expect } from 'vitest';
import {
  calculateScore,
  calculateMapScore,
  calculateTimeBonus,
  calculateRoundPoints,
} from '../utils/scoring.js';
import { config } from '../config/env.js';
import { haversineDistance } from '../utils/haversine.js';

describe('Scoring Utils', () => {
  describe('calculateScore (multiple choice)', () => {
    it('should return 0 for incorrect answers', () => {
      expect(calculateScore(false, 10)).toBe(0);
      expect(calculateScore(false, 5)).toBe(0);
      expect(calculateScore(false, 0)).toBe(0);
    });

    it('should reward faster correct answers with more points', () => {
      const slow = calculateScore(true, 2);
      const fast = calculateScore(true, 8);

      expect(fast).toBeGreaterThan(slow);
      expect(slow).toBeGreaterThanOrEqual(100);
      expect(fast).toBeLessThanOrEqual(150);
    });
  });

  describe('calculateMapScore (accuracy + speed)', () => {
    it('should return 0 for distances out of range', () => {
      expect(calculateMapScore(2000, 10)).toBe(0);
      expect(calculateMapScore(3500, 10)).toBe(0);
    });

    it('should return max points for exact location and full time', () => {
      expect(calculateMapScore(0, 10)).toBe(150);
    });

    it('should reward a faster answer when distance is the same', () => {
      const slow = calculateMapScore(250, 2);
      const fast = calculateMapScore(250, 8);
      expect(fast).toBeGreaterThan(slow);
    });

    it('should reward better accuracy when time is the same', () => {
      const far = calculateMapScore(1200, 6);
      const near = calculateMapScore(200, 6);
      expect(near).toBeGreaterThan(far);
    });
  });

  describe('calculateTimeBonus', () => {
    it('should clamp at 0 when no time remains', () => {
      expect(calculateTimeBonus(0)).toBe(0);
      expect(calculateTimeBonus(-1)).toBe(0);
    });
  });

  describe('calculateRoundPoints', () => {
    it('should fallback to legacy multiple-choice scoring when combo is disabled', () => {
      const original = config.game.enableComboScoring;
      try {
        config.game.enableComboScoring = false;

        const legacy = calculateScore(true, 8);
        const round = calculateRoundPoints({
          isCorrect: true,
          timeRemaining: 8,
          streakCount: 5,
        });

        expect(round).toBe(legacy);
      } finally {
        config.game.enableComboScoring = original;
      }
    });

    it('should add combo bonus only for correct answers when combo is enabled', () => {
      const original = {
        enabled: config.game.enableComboScoring,
        step: config.game.comboStep,
        cap: config.game.comboCap,
        threshold: config.game.fastAnswerThreshold,
      };

      try {
        config.game.enableComboScoring = true;
        config.game.comboStep = 8;
        config.game.comboCap = 24;
        config.game.fastAnswerThreshold = 3;

        const correctPoints = calculateRoundPoints({
          isCorrect: true,
          timeRemaining: 6,
          streakCount: 4,
        });

        const incorrectPoints = calculateRoundPoints({
          isCorrect: false,
          timeRemaining: 6,
          streakCount: 4,
        });

        expect(correctPoints).toBe(calculateScore(true, 6) + 24);
        expect(incorrectPoints).toBe(0);
      } finally {
        config.game.enableComboScoring = original.enabled;
        config.game.comboStep = original.step;
        config.game.comboCap = original.cap;
        config.game.fastAnswerThreshold = original.threshold;
      }
    });

    it('should support map rounds and keep map base scoring compatible', () => {
      const original = config.game.enableComboScoring;
      try {
        config.game.enableComboScoring = false;

        const mapBase = calculateMapScore(250, 8);
        const mapRound = calculateRoundPoints({
          isCorrect: true,
          timeRemaining: 8,
          streakCount: 3,
          distanceKm: 250,
        });

        expect(mapRound).toBe(mapBase);
      } finally {
        config.game.enableComboScoring = original;
      }
    });
  });
});

describe('Haversine Distance', () => {
  it('should return 0 for same coordinates', () => {
    expect(haversineDistance(0, 0, 0, 0)).toBe(0);
    expect(haversineDistance(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it('should calculate distance between New York and Los Angeles (~3940 km)', () => {
    const nyLat = 40.7128;
    const nyLon = -74.006;
    const laLat = 34.0522;
    const laLon = -118.2437;
    const distance = haversineDistance(nyLat, nyLon, laLat, laLon);
    expect(distance).toBeGreaterThan(3900);
    expect(distance).toBeLessThan(4000);
  });

  it('should calculate distance between London and Paris (~344 km)', () => {
    const londonLat = 51.5074;
    const londonLon = -0.1278;
    const parisLat = 48.8566;
    const parisLon = 2.3522;
    const distance = haversineDistance(londonLat, londonLon, parisLat, parisLon);
    expect(distance).toBeGreaterThan(340);
    expect(distance).toBeLessThan(350);
  });
});
