import { CompetitiveOutcome } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  INITIAL_RATING,
  PLACEMENT_GAMES,
  calculateExpectedScore,
  calculateRatingPair,
  getCompetitiveTier,
  placementGamesRemaining,
  toRatingSummary,
} from '../services/competitiveRating.service.js';

describe('competitive rating service', () => {
  it('uses 1000 as the initial virtual rating', () => {
    expect(INITIAL_RATING).toBe(1000);
    expect(toRatingSummary(null)).toMatchObject({
      rating: 1000,
      peakRating: 1000,
      gamesPlayed: 0,
      provisional: true,
      placementGamesRemaining: PLACEMENT_GAMES,
      rank: null,
      tier: 'CALIBRATING',
    });
  });

  it('calculates equal-rating win/loss and draw outcomes', () => {
    expect(calculateExpectedScore(1000, 1000)).toBe(0.5);

    const win = calculateRatingPair(1000, 1000, CompetitiveOutcome.WIN);
    expect(win.player1).toMatchObject({ ratingBefore: 1000, ratingDelta: 16, ratingAfter: 1016 });
    expect(win.player2).toMatchObject({ ratingBefore: 1000, ratingDelta: -16, ratingAfter: 984 });

    const draw = calculateRatingPair(1000, 1000, CompetitiveOutcome.DRAW);
    expect(draw.player1.ratingDelta).toBe(0);
    expect(draw.player2.ratingDelta).toBe(0);
  });

  it('keeps rating changes zero-sum, including floor adjustments', () => {
    const upset = calculateRatingPair(800, 1400, CompetitiveOutcome.WIN);
    const expected = calculateRatingPair(1400, 800, CompetitiveOutcome.WIN);
    expect(upset.player1.ratingDelta).toBeGreaterThan(expected.player1.ratingDelta);
    expect(upset.player1.ratingDelta + upset.player2.ratingDelta).toBe(0);

    const floor = calculateRatingPair(101, 100, CompetitiveOutcome.LOSS);
    expect(floor.player1.ratingAfter).toBe(100);
    expect(floor.player1.ratingDelta + floor.player2.ratingDelta).toBe(0);
  });

  it('exposes placement and tier thresholds server-side', () => {
    expect(placementGamesRemaining(0)).toBe(5);
    expect(placementGamesRemaining(5)).toBe(0);
    expect(getCompetitiveTier(1500, 4)).toBe('CALIBRATING');
    expect(getCompetitiveTier(899, 5)).toBe('EXPLORER');
    expect(getCompetitiveTier(900, 5)).toBe('PATHFINDER');
    expect(getCompetitiveTier(1050, 5)).toBe('CARTOGRAPHER');
    expect(getCompetitiveTier(1200, 5)).toBe('NAVIGATOR');
    expect(getCompetitiveTier(1400, 5)).toBe('ATLAS_MASTER');
  });
});
