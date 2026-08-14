import {
  CompetitiveLadder,
  CompetitiveOutcome,
  CompetitiveRating,
  DuelMatch,
  Prisma,
} from '@prisma/client';

export const INITIAL_RATING = 1000;
export const ELO_K = 32;
export const PLACEMENT_GAMES = 5;
export const RATING_VERSION = 1;
export const MIN_RATING = 100;

export type CompetitiveTier =
  | 'CALIBRATING'
  | 'EXPLORER'
  | 'PATHFINDER'
  | 'CARTOGRAPHER'
  | 'NAVIGATOR'
  | 'ATLAS_MASTER';

export interface RatingPairResult {
  player1: {
    ratingBefore: number;
    ratingDelta: number;
    ratingAfter: number;
    outcome: CompetitiveOutcome;
  };
  player2: {
    ratingBefore: number;
    ratingDelta: number;
    ratingAfter: number;
    outcome: CompetitiveOutcome;
  };
}

export interface AppliedRatingChange {
  userId: string;
  ladder: CompetitiveLadder;
  outcome: CompetitiveOutcome;
  ratingBefore: number;
  ratingDelta: number;
  ratingAfter: number;
  peakRating: number;
  gamesPlayed: number;
  provisional: boolean;
  placementGamesRemaining: number;
  tier: CompetitiveTier;
}

interface RatingParticipant {
  userId: string;
}

export function calculateExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

export function calculateRatingChange(ratingA: number, ratingB: number, resultA: 0 | 0.5 | 1): number {
  return Math.round(ELO_K * (resultA - calculateExpectedScore(ratingA, ratingB)));
}

function scoreFromOutcome(outcome: CompetitiveOutcome): 0 | 0.5 | 1 {
  if (outcome === CompetitiveOutcome.WIN) return 1;
  if (outcome === CompetitiveOutcome.DRAW) return 0.5;
  return 0;
}

function normalizeFloor(ratingA: number, ratingB: number, deltaA: number): { deltaA: number; deltaB: number } {
  let nextDeltaA = deltaA;
  let nextDeltaB = -deltaA;

  if (ratingA + nextDeltaA < MIN_RATING) {
    nextDeltaA = MIN_RATING - ratingA;
    nextDeltaB = -nextDeltaA;
  }

  if (ratingB + nextDeltaB < MIN_RATING) {
    nextDeltaB = MIN_RATING - ratingB;
    nextDeltaA = -nextDeltaB;
  }

  return {
    deltaA: Object.is(nextDeltaA, -0) ? 0 : nextDeltaA,
    deltaB: Object.is(nextDeltaB, -0) ? 0 : nextDeltaB,
  };
}

export function calculateRatingPair(
  rating1: number,
  rating2: number,
  outcome1: CompetitiveOutcome
): RatingPairResult {
  const outcome2 =
    outcome1 === CompetitiveOutcome.WIN
      ? CompetitiveOutcome.LOSS
      : outcome1 === CompetitiveOutcome.LOSS
        ? CompetitiveOutcome.WIN
        : CompetitiveOutcome.DRAW;
  const rawDelta1 = calculateRatingChange(rating1, rating2, scoreFromOutcome(outcome1));
  const { deltaA, deltaB } = normalizeFloor(rating1, rating2, rawDelta1);

  return {
    player1: {
      ratingBefore: rating1,
      ratingDelta: deltaA,
      ratingAfter: rating1 + deltaA,
      outcome: outcome1,
    },
    player2: {
      ratingBefore: rating2,
      ratingDelta: deltaB,
      ratingAfter: rating2 + deltaB,
      outcome: outcome2,
    },
  };
}

export function getCompetitiveTier(rating: number, gamesPlayed: number): CompetitiveTier {
  if (gamesPlayed < PLACEMENT_GAMES) return 'CALIBRATING';
  if (rating < 900) return 'EXPLORER';
  if (rating < 1050) return 'PATHFINDER';
  if (rating < 1200) return 'CARTOGRAPHER';
  if (rating < 1400) return 'NAVIGATOR';
  return 'ATLAS_MASTER';
}

export function placementGamesRemaining(gamesPlayed: number): number {
  return Math.max(0, PLACEMENT_GAMES - gamesPlayed);
}

export function toRatingSummary(
  rating: Pick<CompetitiveRating, 'rating' | 'peakRating' | 'gamesPlayed' | 'wins' | 'draws' | 'losses'> | null,
  rank: number | null = null
) {
  const row = rating ?? {
    rating: INITIAL_RATING,
    peakRating: INITIAL_RATING,
    gamesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
  };

  const provisional = row.gamesPlayed < PLACEMENT_GAMES;

  return {
    rating: row.rating,
    peakRating: row.peakRating,
    gamesPlayed: row.gamesPlayed,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    provisional,
    placementGamesRemaining: placementGamesRemaining(row.gamesPlayed),
    rank: provisional ? null : rank,
    tier: getCompetitiveTier(row.rating, row.gamesPlayed),
  };
}

async function getRatingSnapshot(
  tx: Prisma.TransactionClient,
  userId: string,
  ladder: CompetitiveLadder
): Promise<CompetitiveRating | null> {
  return tx.competitiveRating.findUnique({
    where: {
      userId_ladder: { userId, ladder },
    },
  });
}

function outcomeForPlayer(userId: string, winnerId: string | null): CompetitiveOutcome {
  if (winnerId === null) return CompetitiveOutcome.DRAW;
  return userId === winnerId ? CompetitiveOutcome.WIN : CompetitiveOutcome.LOSS;
}

export async function applyCompetitiveRatingForDuel(
  tx: Prisma.TransactionClient,
  duelMatch: DuelMatch,
  player1: RatingParticipant,
  player2: RatingParticipant,
  winnerId: string | null,
  ladder: CompetitiveLadder,
  now: Date = new Date()
): Promise<AppliedRatingChange[]> {
  // TODO: if future multi-instance matchmaking allows the same user to finish
  // concurrent rated matches, protect these snapshots with row locking or a
  // serializable transaction.
  const [rating1, rating2] = await Promise.all([
    getRatingSnapshot(tx, player1.userId, ladder),
    getRatingSnapshot(tx, player2.userId, ladder),
  ]);

  const outcome1 = outcomeForPlayer(player1.userId, winnerId);
  const pair = calculateRatingPair(
    rating1?.rating ?? INITIAL_RATING,
    rating2?.rating ?? INITIAL_RATING,
    outcome1
  );

  const playerChanges = [
    { userId: player1.userId, before: rating1, change: pair.player1 },
    { userId: player2.userId, before: rating2, change: pair.player2 },
  ];

  const applied: AppliedRatingChange[] = [];

  for (const item of playerChanges) {
    const previousPeak = item.before?.peakRating ?? INITIAL_RATING;
    const gamesPlayed = (item.before?.gamesPlayed ?? 0) + 1;
    const peakRating = Math.max(previousPeak, item.change.ratingAfter);

    await tx.competitiveRating.upsert({
      where: {
        userId_ladder: { userId: item.userId, ladder },
      },
      create: {
        userId: item.userId,
        ladder,
        rating: item.change.ratingAfter,
        peakRating,
        gamesPlayed,
        wins: item.change.outcome === CompetitiveOutcome.WIN ? 1 : 0,
        draws: item.change.outcome === CompetitiveOutcome.DRAW ? 1 : 0,
        losses: item.change.outcome === CompetitiveOutcome.LOSS ? 1 : 0,
        lastMatchAt: now,
      },
      update: {
        rating: item.change.ratingAfter,
        peakRating,
        gamesPlayed,
        wins: item.change.outcome === CompetitiveOutcome.WIN ? { increment: 1 } : undefined,
        draws: item.change.outcome === CompetitiveOutcome.DRAW ? { increment: 1 } : undefined,
        losses: item.change.outcome === CompetitiveOutcome.LOSS ? { increment: 1 } : undefined,
        lastMatchAt: now,
      },
    });

    await tx.competitiveRatingChange.create({
      data: {
        duelMatchId: duelMatch.id,
        userId: item.userId,
        ladder,
        outcome: item.change.outcome,
        ratingBefore: item.change.ratingBefore,
        ratingDelta: item.change.ratingDelta,
        ratingAfter: item.change.ratingAfter,
        createdAt: now,
      },
    });

    applied.push({
      userId: item.userId,
      ladder,
      outcome: item.change.outcome,
      ratingBefore: item.change.ratingBefore,
      ratingDelta: item.change.ratingDelta,
      ratingAfter: item.change.ratingAfter,
      peakRating,
      gamesPlayed,
      provisional: gamesPlayed < PLACEMENT_GAMES,
      placementGamesRemaining: placementGamesRemaining(gamesPlayed),
      tier: getCompetitiveTier(item.change.ratingAfter, gamesPlayed),
    });
  }

  return applied;
}
