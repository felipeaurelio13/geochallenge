import express from 'express';
import { AddressInfo } from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompetitiveLadder, CompetitiveOutcome } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  competitiveRatingFindMany: vi.fn(),
  competitiveRatingFindUnique: vi.fn(),
  competitiveRatingCount: vi.fn(),
  competitiveRatingChangeFindMany: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
  prisma: {
    competitiveRating: {
      findMany: mocks.competitiveRatingFindMany,
      findUnique: mocks.competitiveRatingFindUnique,
      count: mocks.competitiveRatingCount,
    },
    competitiveRatingChange: {
      findMany: mocks.competitiveRatingChangeFindMany,
    },
  },
}));

vi.mock('../middleware/auth.js', () => ({
  authenticateJWT: (req: { headers: Record<string, string | undefined>; user?: { userId: string } }, res: any, next: () => void) => {
    if (!req.headers.authorization) {
      res.status(401).json({ error: 'Token de autenticación requerido' });
      return;
    }
    req.user = { userId: 'me' };
    next();
  },
}));

import competitionRouter from '../controllers/competition.controller.js';

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/competition', competitionRouter);
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, baseUrl };
}

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const { server, baseUrl } = startServer();
  try {
    return await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

function authHeaders() {
  return { authorization: 'Bearer test-token' };
}

describe('competition controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.competitiveRatingFindMany.mockResolvedValue([]);
    mocks.competitiveRatingFindUnique.mockResolvedValue(null);
    mocks.competitiveRatingCount.mockResolvedValue(0);
    mocks.competitiveRatingChangeFindMany.mockResolvedValue([]);
  });

  it('GET /overview returns virtual 1000 summaries for a new user', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/competition/overview`, { headers: authHeaders() });
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(body.ladders.CLASSIC).toMatchObject({
        rating: 1000,
        peakRating: 1000,
        gamesPlayed: 0,
        provisional: true,
        placementGamesRemaining: 5,
        rank: null,
        tier: 'CALIBRATING',
      });
      expect(body.ladders.GEO_CHALLENGE).toMatchObject({
        rating: 1000,
        provisional: true,
        placementGamesRemaining: 5,
        rank: null,
      });
    });
  });

  it('GET /overview keeps ladders independent, ranks established players, and returns recent rated matches', async () => {
    mocks.competitiveRatingFindMany.mockResolvedValue([
      {
        userId: 'me',
        ladder: CompetitiveLadder.CLASSIC,
        rating: 1210,
        peakRating: 1250,
        gamesPlayed: 8,
        wins: 5,
        draws: 1,
        losses: 2,
      },
      {
        userId: 'me',
        ladder: CompetitiveLadder.GEO_CHALLENGE,
        rating: 990,
        peakRating: 1016,
        gamesPlayed: 3,
        wins: 1,
        draws: 1,
        losses: 1,
      },
    ]);
    mocks.competitiveRatingFindUnique.mockImplementation(({ where }: any) => {
      if (where.userId_ladder.ladder === CompetitiveLadder.CLASSIC) {
        return Promise.resolve({ userId: 'me', ladder: CompetitiveLadder.CLASSIC, rating: 1210, gamesPlayed: 8 });
      }
      return Promise.resolve({ userId: 'me', ladder: CompetitiveLadder.GEO_CHALLENGE, rating: 990, gamesPlayed: 3 });
    });
    mocks.competitiveRatingCount.mockResolvedValueOnce(2);
    mocks.competitiveRatingChangeFindMany.mockResolvedValue([
      {
        duelMatchId: 'dm1',
        userId: 'me',
        ladder: CompetitiveLadder.CLASSIC,
        outcome: CompetitiveOutcome.WIN,
        ratingBefore: 1194,
        ratingDelta: 16,
        ratingAfter: 1210,
        createdAt: new Date('2026-08-14T10:00:00Z'),
        duelMatch: {
          player1Id: 'me',
          player2Id: 'opponent-1',
          player1: { id: 'me', username: 'Felipe' },
          player2: { id: 'opponent-1', username: 'Laura' },
        },
      },
      {
        duelMatchId: 'dm2',
        userId: 'me',
        ladder: CompetitiveLadder.GEO_CHALLENGE,
        outcome: CompetitiveOutcome.DRAW,
        ratingBefore: 990,
        ratingDelta: 0,
        ratingAfter: 990,
        createdAt: new Date('2026-08-14T09:00:00Z'),
        duelMatch: {
          player1Id: 'opponent-2',
          player2Id: 'me',
          player1: { id: 'opponent-2', username: 'Ana' },
          player2: { id: 'me', username: 'Felipe' },
        },
      },
    ]);

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/competition/overview`, { headers: authHeaders() });
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(body.ladders.CLASSIC).toMatchObject({
        rating: 1210,
        peakRating: 1250,
        gamesPlayed: 8,
        wins: 5,
        draws: 1,
        losses: 2,
        provisional: false,
        placementGamesRemaining: 0,
        rank: 3,
        tier: 'NAVIGATOR',
      });
      expect(body.ladders.GEO_CHALLENGE).toMatchObject({
        rating: 990,
        provisional: true,
        rank: null,
        tier: 'CALIBRATING',
      });
      expect(body.recentMatches).toEqual([
        expect.objectContaining({
          duelMatchId: 'dm1',
          ladder: 'CLASSIC',
          opponent: { id: 'opponent-1', username: 'Laura' },
          result: 'win',
          ratingBefore: 1194,
          ratingDelta: 16,
          ratingAfter: 1210,
        }),
        expect.objectContaining({
          duelMatchId: 'dm2',
          opponent: { id: 'opponent-2', username: 'Ana' },
          result: 'draw',
        }),
      ]);
      expect(mocks.competitiveRatingChangeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'me', duelMatch: { rated: true } },
        })
      );
    });
  });

  it('GET /leaderboard validates auth and ladder', async () => {
    await withServer(async (baseUrl) => {
      const noAuth = await fetch(`${baseUrl}/api/competition/leaderboard?ladder=CLASSIC`);
      expect(noAuth.status).toBe(401);

      const missing = await fetch(`${baseUrl}/api/competition/leaderboard`, { headers: authHeaders() });
      expect(missing.status).toBe(400);

      const invalid = await fetch(`${baseUrl}/api/competition/leaderboard?ladder=BAD`, { headers: authHeaders() });
      const body = await invalid.json() as { code: string };
      expect(invalid.status).toBe(400);
      expect(body.code).toBe('COMPETITION_INVALID_LADDER');
    });
  });

  it('GET /leaderboard filters by ladder, excludes placements, orders, shares rank, and clamps limit', async () => {
    mocks.competitiveRatingFindMany.mockResolvedValue([
      {
        userId: 'u-high',
        ladder: CompetitiveLadder.CLASSIC,
        rating: 1300,
        peakRating: 1300,
        gamesPlayed: 5,
        wins: 4,
        draws: 0,
        losses: 1,
        user: { username: 'High' },
      },
      {
        userId: 'u-tie-more',
        ladder: CompetitiveLadder.CLASSIC,
        rating: 1200,
        peakRating: 1200,
        gamesPlayed: 10,
        wins: 6,
        draws: 2,
        losses: 2,
        user: { username: 'Tie More' },
      },
      {
        userId: 'u-tie-less',
        ladder: CompetitiveLadder.CLASSIC,
        rating: 1200,
        peakRating: 1200,
        gamesPlayed: 5,
        wins: 3,
        draws: 1,
        losses: 1,
        user: { username: 'Tie Less' },
      },
    ]);
    mocks.competitiveRatingCount.mockImplementation(({ where }: any) => {
      if (where.rating?.gt === 1300) return Promise.resolve(0);
      if (where.rating?.gt === 1200) return Promise.resolve(1);
      return Promise.resolve(0);
    });
    mocks.competitiveRatingFindUnique.mockResolvedValue({
      userId: 'me',
      ladder: CompetitiveLadder.CLASSIC,
      rating: 1000,
      peakRating: 1000,
      gamesPlayed: 4,
      wins: 2,
      draws: 1,
      losses: 1,
    });

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/competition/leaderboard?ladder=CLASSIC&limit=999`, {
        headers: authHeaders(),
      });
      const body = await response.json() as any;

      expect(response.status).toBe(200);
      expect(mocks.competitiveRatingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ladder: CompetitiveLadder.CLASSIC, gamesPlayed: { gte: 5 } },
          orderBy: [{ rating: 'desc' }, { gamesPlayed: 'desc' }, { userId: 'asc' }],
          take: 100,
        })
      );
      expect(body.leaderboard.map((entry: any) => [entry.userId, entry.rank, entry.rating])).toEqual([
        ['u-high', 1, 1300],
        ['u-tie-more', 2, 1200],
        ['u-tie-less', 2, 1200],
      ]);
      expect(body.me).toMatchObject({
        rating: 1000,
        provisional: true,
        rank: null,
      });
    });
  });

  it('GET /leaderboard never mixes CLASSIC and GEO_CHALLENGE', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/competition/leaderboard?ladder=GEO_CHALLENGE&limit=0`, {
        headers: authHeaders(),
      });

      expect(response.status).toBe(200);
      expect(mocks.competitiveRatingFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ladder: CompetitiveLadder.GEO_CHALLENGE, gamesPlayed: { gte: 5 } },
          take: 50,
        })
      );
    });
  });
});
