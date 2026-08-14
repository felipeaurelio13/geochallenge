import { Router, Response } from 'express';
import { CompetitiveLadder, CompetitiveOutcome } from '@prisma/client';
import { prisma } from '../config/database.js';
import { authenticateJWT, AuthRequest } from '../middleware/auth.js';
import {
  PLACEMENT_GAMES,
  getCompetitiveTier,
  toRatingSummary,
} from '../services/competitiveRating.service.js';

const router = Router();

const SUPPORTED_LADDERS: readonly CompetitiveLadder[] = [
  CompetitiveLadder.CLASSIC,
  CompetitiveLadder.GEO_CHALLENGE,
];

function parseLadder(raw: unknown): CompetitiveLadder | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toUpperCase();
  return (SUPPORTED_LADDERS as readonly string[]).includes(normalized)
    ? (normalized as CompetitiveLadder)
    : null;
}

function clampLimit(raw: unknown): number {
  const parsed = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 50;
  return Math.min(Math.max(parsed, 1), 100);
}

async function getPublicRank(userId: string, ladder: CompetitiveLadder): Promise<number | null> {
  const rating = await prisma.competitiveRating.findUnique({
    where: { userId_ladder: { userId, ladder } },
  });
  if (!rating || rating.gamesPlayed < PLACEMENT_GAMES) return null;

  const betterPlayers = await prisma.competitiveRating.count({
    where: {
      ladder,
      gamesPlayed: { gte: PLACEMENT_GAMES },
      rating: { gt: rating.rating },
    },
  });

  return betterPlayers + 1;
}

function outcomeToResult(outcome: CompetitiveOutcome): 'win' | 'draw' | 'loss' {
  if (outcome === CompetitiveOutcome.WIN) return 'win';
  if (outcome === CompetitiveOutcome.DRAW) return 'draw';
  return 'loss';
}

router.get('/overview', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const [ratings, classicRank, geoRank, recentChanges] = await Promise.all([
      prisma.competitiveRating.findMany({
        where: { userId },
      }),
      getPublicRank(userId, CompetitiveLadder.CLASSIC),
      getPublicRank(userId, CompetitiveLadder.GEO_CHALLENGE),
      prisma.competitiveRatingChange.findMany({
        where: { userId, duelMatch: { rated: true } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          duelMatch: {
            include: {
              player1: { select: { id: true, username: true } },
              player2: { select: { id: true, username: true } },
            },
          },
        },
      }),
    ]);

    const byLadder = new Map(ratings.map((rating) => [rating.ladder, rating]));
    const recentMatches = recentChanges.map((change) => {
      const opponent =
        change.duelMatch.player1Id === userId
          ? change.duelMatch.player2
          : change.duelMatch.player1;

      return {
        duelMatchId: change.duelMatchId,
        ladder: change.ladder,
        opponent: {
          id: opponent.id,
          username: opponent.username,
        },
        result: outcomeToResult(change.outcome),
        ratingBefore: change.ratingBefore,
        ratingDelta: change.ratingDelta,
        ratingAfter: change.ratingAfter,
        createdAt: change.createdAt,
      };
    });

    res.json({
      ladders: {
        CLASSIC: toRatingSummary(byLadder.get(CompetitiveLadder.CLASSIC) ?? null, classicRank),
        GEO_CHALLENGE: toRatingSummary(byLadder.get(CompetitiveLadder.GEO_CHALLENGE) ?? null, geoRank),
      },
      recentMatches,
    });
  } catch (error) {
    console.error('Error al obtener overview competitivo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/leaderboard', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const ladder = parseLadder(req.query.ladder);
    if (!ladder) {
      res.status(400).json({
        error: 'Ladder competitivo inválido',
        code: 'COMPETITION_INVALID_LADDER',
      });
      return;
    }
    const limit = clampLimit(req.query.limit);
    const rows = await prisma.competitiveRating.findMany({
      where: {
        ladder,
        gamesPlayed: { gte: PLACEMENT_GAMES },
      },
      orderBy: [
        { rating: 'desc' },
        { gamesPlayed: 'desc' },
        { userId: 'asc' },
      ],
      take: limit,
      include: {
        user: { select: { username: true } },
      },
    });

    const rankCache = new Map<number, number>();
    const leaderboard = await Promise.all(
      rows.map(async (row) => {
        if (!rankCache.has(row.rating)) {
          rankCache.set(
            row.rating,
            await prisma.competitiveRating.count({
              where: {
                ladder,
                gamesPlayed: { gte: PLACEMENT_GAMES },
                rating: { gt: row.rating },
              },
            }) + 1
          );
        }

        return {
          rank: rankCache.get(row.rating)!,
          userId: row.userId,
          username: row.user.username,
          rating: row.rating,
          tier: getCompetitiveTier(row.rating, row.gamesPlayed),
          gamesPlayed: row.gamesPlayed,
          wins: row.wins,
          draws: row.draws,
          losses: row.losses,
        };
      })
    );

    const meRank = await getPublicRank(req.user!.userId, ladder);
    const meRating = await prisma.competitiveRating.findUnique({
      where: { userId_ladder: { userId: req.user!.userId, ladder } },
    });

    res.json({
      ladder,
      leaderboard,
      me: toRatingSummary(meRating, meRank),
    });
  } catch (error) {
    console.error('Error al obtener leaderboard competitivo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
