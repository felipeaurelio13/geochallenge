import { Router, Response } from 'express';
import { authenticateJWT, optionalAuth, AuthRequest } from '../middleware/auth.js';
import {
  getTopLeaderboard,
  getUserRank,
  getUserLeaderboardContext,
  getLeaderboardStats,
  getSeasonLeaderboard,
  getSeasonLeaderboardStats,
  getSeasonUserRank,
} from '../services/leaderboard.service.js';

const router = Router();
const SUPPORTED_LEADERBOARD_SCOPES = ['global', 'season'] as const;
type LeaderboardScope = (typeof SUPPORTED_LEADERBOARD_SCOPES)[number];

export function resolveLeaderboardScope(rawScope: unknown): {
  requestedScope: LeaderboardScope;
  effectiveScope: LeaderboardScope;
  fallbackApplied: boolean;
} {
  const normalizedScope = typeof rawScope === 'string' ? rawScope.toLowerCase() : 'global';
  const requestedScope: LeaderboardScope = normalizedScope === 'season' ? 'season' : 'global';
  const isSupported = SUPPORTED_LEADERBOARD_SCOPES.includes(
    requestedScope as (typeof SUPPORTED_LEADERBOARD_SCOPES)[number]
  );

  return {
    requestedScope,
    effectiveScope: isSupported ? requestedScope : 'global',
    fallbackApplied: !isSupported,
  };
}

/**
 * GET /api/leaderboard
 * Obtener top del leaderboard global
 */
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
    const scopeResolution = resolveLeaderboardScope(req.query.scope);
    const clampedLimit = Math.min(limit, 100);
    const isSeasonScope = scopeResolution.effectiveScope === 'season';
    const leaderboard = isSeasonScope
      ? await getSeasonLeaderboard(clampedLimit)
      : await getTopLeaderboard(clampedLimit);
    const stats = isSeasonScope ? await getSeasonLeaderboardStats() : await getLeaderboardStats();

    // Si hay usuario autenticado, incluir su posición
    let userRank = null;
    if (req.user) {
      userRank = isSeasonScope
        ? await getSeasonUserRank(req.user.userId)
        : await getUserRank(req.user.userId);
    }

    const response: Record<string, unknown> = {
      leaderboard,
      totalPlayers: stats.totalPlayers,
      topScore: stats.topScore,
      avgScore: stats.avgScore,
      userRank: userRank
        ? {
            rank: userRank.rank,
            score: userRank.score,
          }
        : null,
      generatedAt: new Date().toISOString(),
      queryMeta: {
        requestedScope: scopeResolution.requestedScope,
        effectiveScope: scopeResolution.effectiveScope,
        fallbackApplied: scopeResolution.fallbackApplied,
      },
    };

    if (isSeasonScope) {
      response.season = new Date().toISOString().slice(0, 7);
      response.window = 'month';
      response.seasonUserRank = userRank
        ? {
            rank: userRank.rank,
            score: userRank.score,
          }
        : null;
    }

    res.json(response);
  } catch (error) {
    console.error('Error al obtener leaderboard:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/leaderboard/me
 * Obtener posición del usuario actual con contexto
 */
router.get('/me', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const context = await getUserLeaderboardContext(req.user!.userId, 3);

    if (!context.userRank) {
      res.json({
        message: 'Aún no tienes puntaje en el ranking',
        userRank: null,
        neighbors: [],
      });
      return;
    }

    res.json({
      userRank: context.userRank,
      neighbors: context.neighbors,
    });
  } catch (error) {
    console.error('Error al obtener posición:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/leaderboard/stats
 * Estadísticas generales del leaderboard
 */
router.get('/stats', async (req, res: Response) => {
  try {
    const stats = await getLeaderboardStats();
    const top3 = await getTopLeaderboard(3);

    res.json({
      ...stats,
      top3,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
