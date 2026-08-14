import { Category, CompetitiveLadder, DuelFinishReason } from '@prisma/client';
import { beforeEach, describe, expect, it } from 'vitest';
import { AnswerResult } from '../services/game.service.js';
import { PersistableDuel, persistDuelResults } from '../services/duelPersistence.service.js';

function answer(questionId: string, isCorrect = true, points = 100): AnswerResult {
  return {
    questionId,
    isCorrect,
    correctAnswer: 'A',
    userAnswer: isCorrect ? 'A' : 'B',
    points,
    timeRemaining: 5,
  };
}

type FakeUser = {
  id: string;
  highScore: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
};

type FakeState = {
  users: Record<string, FakeUser>;
  duelMatches: any[];
  gameResults: any[];
  competitiveRatings: Record<string, any>;
  competitiveRatingChanges: any[];
  masteryAttempts: any[];
  failOnRatingChangeCreate: boolean;
};

function cloneState(state: FakeState): FakeState {
  return structuredClone(state);
}

function ratingKey(userId: string, ladder: CompetitiveLadder): string {
  return `${userId}:${ladder}`;
}

function applyIncrement(current: number, value: any): number {
  return value && typeof value.increment === 'number' ? current + value.increment : current;
}

function makeTx(state: FakeState) {
  return {
    duelMatch: {
      create: async ({ data }: any) => {
        if (data.runId && state.duelMatches.some((match) => match.runId === data.runId)) {
          throw { code: 'P2002' };
        }
        const row = { id: `dm-${state.duelMatches.length + 1}`, createdAt: new Date(), ...data };
        state.duelMatches.push(row);
        return row;
      },
      findUnique: async ({ where, include }: any) => {
        const row = state.duelMatches.find((match) => match.runId === where.runId) ?? null;
        if (!row || !include?.ratingChanges) return row;
        return {
          ...row,
          ratingChanges: state.competitiveRatingChanges.filter((change) => change.duelMatchId === row.id),
        };
      },
    },
    gameResult: {
      create: async ({ data }: any) => {
        if (data.runId && state.gameResults.some((result) => result.runId === data.runId)) {
          throw { code: 'P2002' };
        }
        const row = { id: `gr-${state.gameResults.length + 1}`, createdAt: new Date(), ...data };
        state.gameResults.push(row);
        return row;
      },
      findUnique: async ({ where }: any) => (
        state.gameResults.find((result) => result.runId === where.runId) ?? null
      ),
    },
    user: {
      findUnique: async ({ where }: any) => state.users[where.id],
      update: async ({ where, data }: any) => {
        const user = state.users[where.id];
        user.gamesPlayed = applyIncrement(user.gamesPlayed, data.gamesPlayed);
        user.wins = applyIncrement(user.wins, data.wins);
        user.losses = applyIncrement(user.losses, data.losses);
        if (typeof data.highScore === 'number') {
          user.highScore = data.highScore;
        }
        return user;
      },
    },
    question: {
      findMany: async () => [],
    },
    masteryAttempt: {
      createMany: async ({ data }: any) => {
        state.masteryAttempts.push(...data);
        return { count: data.length };
      },
    },
    competitiveRating: {
      findUnique: async ({ where }: any) => (
        state.competitiveRatings[ratingKey(where.userId_ladder.userId, where.userId_ladder.ladder)] ?? null
      ),
      upsert: async ({ where, create, update }: any) => {
        const key = ratingKey(where.userId_ladder.userId, where.userId_ladder.ladder);
        const existing = state.competitiveRatings[key];
        if (!existing) {
          state.competitiveRatings[key] = { ...create, createdAt: new Date(), updatedAt: new Date() };
          return state.competitiveRatings[key];
        }
        existing.rating = update.rating;
        existing.peakRating = update.peakRating;
        existing.gamesPlayed = update.gamesPlayed;
        existing.wins = applyIncrement(existing.wins, update.wins);
        existing.draws = applyIncrement(existing.draws, update.draws);
        existing.losses = applyIncrement(existing.losses, update.losses);
        existing.lastMatchAt = update.lastMatchAt;
        existing.updatedAt = new Date();
        return existing;
      },
    },
    competitiveRatingChange: {
      create: async ({ data }: any) => {
        if (state.failOnRatingChangeCreate) {
          throw new Error('rating change write failed');
        }
        if (
          state.competitiveRatingChanges.some(
            (change) => change.duelMatchId === data.duelMatchId && change.userId === data.userId
          )
        ) {
          throw { code: 'P2002' };
        }
        const row = { id: `rc-${state.competitiveRatingChanges.length + 1}`, ...data };
        state.competitiveRatingChanges.push(row);
        return row;
      },
    },
  };
}

function makeDb(state: FakeState) {
  return {
    $transaction: async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
      const draft = cloneState(state);
      const result = await fn(makeTx(draft));
      Object.assign(state, draft);
      return result;
    },
  };
}

function initialState(): FakeState {
  return {
    users: {
      p1: { id: 'p1', highScore: 0, gamesPlayed: 0, wins: 0, losses: 0 },
      p2: { id: 'p2', highScore: 0, gamesPlayed: 0, wins: 0, losses: 0 },
    },
    duelMatches: [],
    gameResults: [],
    competitiveRatings: {},
    competitiveRatingChanges: [],
    masteryAttempts: [],
    failOnRatingChangeCreate: false,
  };
}

function makeDuel(overrides: Partial<PersistableDuel> = {}): PersistableDuel {
  return {
    id: 'duel-1',
    players: [
      {
        userId: 'p1',
        username: 'Uno',
        answers: [answer('q1', true, 100), answer('q2', true, 100)],
        score: 200,
      },
      {
        userId: 'p2',
        username: 'Dos',
        answers: [answer('q1', false, 0), answer('q2', true, 100)],
        score: 100,
      },
    ],
    category: Category.MIXED,
    mode: 'classic',
    rated: true,
    ladder: CompetitiveLadder.CLASSIC,
    startedAt: new Date('2026-08-14T10:00:00Z'),
    ...overrides,
  };
}

describe('duel ranked persistence', () => {
  let state: FakeState;

  beforeEach(() => {
    state = initialState();
  });

  it('persists a completed ranked duel with DuelMatch, GameResult runIds, ratings, W/L and changes', async () => {
    await persistDuelResults(makeDuel(), 'p1', 'completed', makeDb(state) as any);

    expect(state.duelMatches).toHaveLength(1);
    expect(state.duelMatches[0]).toMatchObject({
      runId: 'duel-1',
      rated: true,
      ladder: CompetitiveLadder.CLASSIC,
      finishReason: DuelFinishReason.COMPLETED,
      ratingVersion: 1,
    });
    expect(state.gameResults.map((result) => result.runId).sort()).toEqual([
      'duel-1:p1',
      'duel-1:p2',
    ]);
    expect(state.gameResults).toHaveLength(2);
    expect(state.competitiveRatingChanges).toHaveLength(2);
    expect(state.competitiveRatings[ratingKey('p1', CompetitiveLadder.CLASSIC)]).toMatchObject({
      rating: 1016,
      gamesPlayed: 1,
      wins: 1,
      draws: 0,
      losses: 0,
    });
    expect(state.competitiveRatings[ratingKey('p2', CompetitiveLadder.CLASSIC)]).toMatchObject({
      rating: 984,
      gamesPlayed: 1,
      wins: 0,
      draws: 0,
      losses: 1,
    });
    expect(state.users.p1.wins).toBe(1);
    expect(state.users.p2.losses).toBe(1);
  });

  it('persists a completed draw with competitive draws and coherent zero deltas', async () => {
    const drawDuel = makeDuel({
      players: [
        { userId: 'p1', username: 'Uno', answers: [answer('q1', true, 100)], score: 100 },
        { userId: 'p2', username: 'Dos', answers: [answer('q1', true, 100)], score: 100 },
      ],
    });

    await persistDuelResults(drawDuel, null, 'completed', makeDb(state) as any);

    expect(state.competitiveRatings[ratingKey('p1', CompetitiveLadder.CLASSIC)]).toMatchObject({
      rating: 1000,
      gamesPlayed: 1,
      wins: 0,
      draws: 1,
      losses: 0,
    });
    expect(state.competitiveRatings[ratingKey('p2', CompetitiveLadder.CLASSIC)]).toMatchObject({
      rating: 1000,
      draws: 1,
    });
    expect(state.users.p1.wins).toBe(0);
    expect(state.users.p1.losses).toBe(0);
    expect(state.competitiveRatingChanges.map((change) => change.ratingDelta)).toEqual([0, 0]);
  });

  it('rates post-start disconnect but not pre-start disconnect or cancelled matches', async () => {
    await persistDuelResults(makeDuel({ id: 'post-start' }), 'p1', 'opponent_disconnected', makeDb(state) as any);
    expect(state.duelMatches[0]).toMatchObject({
      finishReason: DuelFinishReason.OPPONENT_DISCONNECTED,
      ratingVersion: 1,
    });
    expect(state.competitiveRatingChanges).toHaveLength(2);

    await persistDuelResults(makeDuel({ id: 'pre-start', startedAt: undefined }), 'p1', 'opponent_disconnected', makeDb(state) as any);
    expect(state.duelMatches[1]).toMatchObject({
      finishReason: DuelFinishReason.OPPONENT_DISCONNECTED,
      ratingVersion: null,
    });
    expect(state.competitiveRatingChanges).toHaveLength(2);

    await persistDuelResults(makeDuel({ id: 'cancelled' }), null, 'cancelled', makeDb(state) as any);
    expect(state.duelMatches[2]).toMatchObject({
      finishReason: DuelFinishReason.CANCELLED,
      ratingVersion: null,
    });
    expect(state.competitiveRatingChanges).toHaveLength(2);
  });

  it('persists casual completed as unrated with no CompetitiveRatingChange', async () => {
    await persistDuelResults(
      makeDuel({ rated: false, ladder: undefined }),
      'p1',
      'completed',
      makeDb(state) as any
    );

    expect(state.duelMatches[0]).toMatchObject({ rated: false, ladder: null, ratingVersion: null });
    expect(state.competitiveRatingChanges).toHaveLength(0);
    expect(Object.keys(state.competitiveRatings)).toHaveLength(0);
  });

  it('is idempotent for the same duelId and does not recalculate Elo on P2002', async () => {
    await persistDuelResults(makeDuel(), 'p1', 'completed', makeDb(state) as any);
    await persistDuelResults(makeDuel(), 'p1', 'completed', makeDb(state) as any);

    expect(state.duelMatches).toHaveLength(1);
    expect(state.gameResults).toHaveLength(2);
    expect(state.competitiveRatingChanges).toHaveLength(2);
    expect(state.competitiveRatings[ratingKey('p1', CompetitiveLadder.CLASSIC)]).toMatchObject({
      rating: 1016,
      gamesPlayed: 1,
      wins: 1,
    });
    expect(state.users.p1.wins).toBe(1);
    expect(state.users.p2.losses).toBe(1);
  });

  it('rolls back DuelMatch, GameResult, W/L and rating if RatingChange creation fails', async () => {
    state.failOnRatingChangeCreate = true;

    await expect(
      persistDuelResults(makeDuel(), 'p1', 'completed', makeDb(state) as any)
    ).rejects.toThrow('rating change write failed');

    expect(state.duelMatches).toHaveLength(0);
    expect(state.gameResults).toHaveLength(0);
    expect(state.competitiveRatingChanges).toHaveLength(0);
    expect(Object.keys(state.competitiveRatings)).toHaveLength(0);
    expect(state.users.p1.wins).toBe(0);
    expect(state.users.p2.losses).toBe(0);
  });
});
