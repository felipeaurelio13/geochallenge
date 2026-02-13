import { Router, Response } from 'express';
import { authenticateJWT, optionalAuth, AuthRequest } from '../middleware/auth.js';
import {
  getTopLeaderboard,
  getUserRank,
  getUserLeaderboardContext,
  getLeaderboardStats,
} from '../services/leaderboard.service.js';

const router = Router();

/**
 * GET /api/leaderboard
 * Obtener top del leaderboard global
 */
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const leaderboard = await getTopLeaderboard(Math.min(limit, 100));
    const stats = await getLeaderboardStats();

    // Si hay usuario autenticado, incluir su posición
    let userRank = null;
    if (req.user) {
      userRank = await getUserRank(req.user.userId);
    }

    res.json({
      leaderboard,
      totalPlayers: stats.totalPlayers,
      topScore: stats.topScore,
      userRank: userRank
        ? {
            rank: userRank.rank,
            score: userRank.score,
          }
        : null,
    });
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
