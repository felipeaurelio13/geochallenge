import { describe, expect, it } from 'vitest';
import { calculateMasteryScore, calculateWorldProgressPercent } from '../services/mastery.service.js';

describe('calculateMasteryScore', () => {
  it('1/1 → masteryScore 13, level LEARNING', () => {
    const result = calculateMasteryScore(1, 1);
    expect(result.masteryScore).toBe(13);
    expect(result.level).toBe('LEARNING');
    expect(result.accuracy).toBe(1);
    expect(result.evidence).toBe(0.125);
  });

  it('3/3 → masteryScore 38, level LEARNING', () => {
    const result = calculateMasteryScore(3, 3);
    expect(result.masteryScore).toBe(38);
    expect(result.level).toBe('LEARNING');
  });

  it('5/5 → masteryScore 63, level STRONG', () => {
    const result = calculateMasteryScore(5, 5);
    expect(result.masteryScore).toBe(63);
    expect(result.level).toBe('STRONG');
  });

  it('7/7 → masteryScore 88, level MASTERED', () => {
    const result = calculateMasteryScore(7, 7);
    expect(result.masteryScore).toBe(88);
    expect(result.level).toBe('MASTERED');
  });

  it('8/8 → masteryScore 100, level MASTERED', () => {
    const result = calculateMasteryScore(8, 8);
    expect(result.masteryScore).toBe(100);
    expect(result.level).toBe('MASTERED');
  });

  it('6/8 → masteryScore 75, level STRONG', () => {
    const result = calculateMasteryScore(8, 6);
    expect(result.masteryScore).toBe(75);
    expect(result.level).toBe('STRONG');
  });

  it('0 attempts → level UNSEEN', () => {
    const result = calculateMasteryScore(0, 0);
    expect(result.masteryScore).toBe(0);
    expect(result.level).toBe('UNSEEN');
  });

  it('0/3 → level LEARNING, score 0', () => {
    const result = calculateMasteryScore(3, 0);
    expect(result.masteryScore).toBe(0);
    expect(result.level).toBe('LEARNING');
  });

  it('40-59 score → level FAMILIAR', () => {
    const result = calculateMasteryScore(4, 2);
    expect(result.masteryScore).toBe(25);
    expect(result.level).toBe('LEARNING');

    const result2 = calculateMasteryScore(5, 3);
    expect(result2.masteryScore).toBe(38);
    expect(result2.level).toBe('LEARNING');
  });
});

describe('calculateWorldProgressPercent', () => {
  it('uses stamped countries and preserves one decimal place', () => {
    expect(calculateWorldProgressPercent(32, 197)).toBe(16.2);
  });

  it('returns 0 when no country has been stamped', () => {
    expect(calculateWorldProgressPercent(0, 197)).toBe(0);
  });
});
