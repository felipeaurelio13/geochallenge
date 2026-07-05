import { describe, expect, it } from 'vitest';
import {
  applyExtendedTime,
  clampTimeRemainingForScoring,
  CINEMA_GEO_EXTRA_READ_SECONDS,
  EXTENDED_TIME_MULTIPLIER,
  getQuestionDuration,
} from '../utils/questionTiming';

describe('applyExtendedTime', () => {
  it('leaves duration unchanged when the accommodation is off', () => {
    expect(applyExtendedTime(10, false)).toBe(10);
  });

  it('multiplies duration by EXTENDED_TIME_MULTIPLIER (+50%) when enabled', () => {
    expect(applyExtendedTime(10, true)).toBe(Math.ceil(10 * EXTENDED_TIME_MULTIPLIER));
    expect(applyExtendedTime(10, true)).toBe(15);
  });

  it('rounds up so the accommodation never grants less than a whole extra second', () => {
    // 7 * 1.5 = 10.5 -> ceil -> 11
    expect(applyExtendedTime(7, true)).toBe(11);
  });

  it('stacks on top of category-adjusted durations (e.g. CINEMA_GEO)', () => {
    const baseDuration = 10;
    const categoryDuration = getQuestionDuration('CINEMA_GEO' as any, baseDuration);
    expect(categoryDuration).toBe(baseDuration + CINEMA_GEO_EXTRA_READ_SECONDS);
    expect(applyExtendedTime(categoryDuration, true)).toBe(Math.ceil(categoryDuration * 1.5));
  });
});

describe('clampTimeRemainingForScoring', () => {
  it('never reports more than baseDuration, regardless of category', () => {
    // Simulates a player with extended time whose on-screen timer ran longer
    // than the server's raw baseDuration (10s) — the backend's Zod schema
    // rejects timeRemaining > config.game.timePerQuestion, so this must clamp.
    expect(clampTimeRemainingForScoring('FLAG' as any, 15, 10)).toBe(10);
    expect(clampTimeRemainingForScoring('CAPITAL' as any, 15, 10)).toBe(10);
    expect(clampTimeRemainingForScoring('CINEMA_GEO' as any, 15, 10)).toBe(10);
  });

  it('passes through values within range unchanged', () => {
    expect(clampTimeRemainingForScoring('FLAG' as any, 4, 10)).toBe(4);
  });

  it('floors negative values at zero', () => {
    expect(clampTimeRemainingForScoring('FLAG' as any, -3, 10)).toBe(0);
  });
});
