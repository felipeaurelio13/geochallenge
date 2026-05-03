import { Router, Response, Request } from 'express';
import { authenticateJWT, optionalAuth, AuthRequest } from '../middleware/auth.js';
import { config } from '../config/env.js';
import {
  getTopLeaderboard,
  getUserRank,
  getUserLeaderboardContext,
  getLeaderboardStats,
  getSeasonLeaderboard,
  getSeasonLeaderboardStats,
  getSeasonUserRank,
  getCurrentSeasonId,
  rebuildAllLeaderboards,
  syncLeaderboardFromDatabase,
  syncSeasonLeaderboardFromDatabase,
  type LeaderboardScope,
} from '../services/leaderboard.service.js';

const router = Router();
const SUPPORTED_LEADERBOARD_SCOPES = ['global', 'season'] as const;

export function resolveLeaderboardScope(rawScope: unknown): {
  requestedScope: LeaderboardScope;
  effectiveScope: LeaderboardScope;
  fallbackApplied: boolean;
} {
  const normalized = typeof rawScope === 'string' ? rawScope.toLowerCase() : '';
  const isSupported = (SUPPORTED_LEADERBOARD_SCOPES as readonly string[]).includes(normalized);
  const requestedScope: LeaderboardScope = isSupported
    ? (normalized as LeaderboardScope)
    : 'global';
  // Si llega un valor desconocido (p. ej. legacy 'weekly' o 'friends'), normalizamos a global
  // y reportamos fallbackApplied=true para que el cliente sepa.
  const fallbackApplied = normalized.length > 0 && !isSupported;
  return { requestedScope, effectiveScope: requestedScope, fallbackApplied };
}

function clampLimit(raw: unknown, fallback = 50, max = 100): number {
  const parsed = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

/**
 * GET /api/leaderboard?scope=global|season&limit=50
 */
router.get('/', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const limit = clampLimit(req.query.limit, 50, 100);
    const scopeResolution = resolveLeaderboardScope(req.query.scope);
    const isSeasonScope = scopeResolution.effectiveScope === 'season';
    const seasonId = getCurrentSeasonId();

    const [leaderboard, stats] = await Promise.all([
      isSeasonScope ? getSeasonLeaderboard(limit, seasonId) : getTopLeaderboard(limit),
      isSeasonScope ? getSeasonLeaderboardStats(seasonId) : getLeaderboardStats(),
    ]);

    let userRank: { rank: number | null; score: number | null } | null = null;
    if (req.user) {
      userRank = isSeasonScope
        ? await getSeasonUserRank(req.user.userId, seasonId)
        : await getUserRank(req.user.userId);
    }

    const response: Record<string, unknown> = {
      leaderboard,
      totalPlayers: stats.totalPlayers,
      topScore: stats.topScore,
      avgScore: stats.avgScore,
      userRank: userRank ? { rank: userRank.rank, score: userRank.score } : null,
      generatedAt: new Date().toISOString(),
      scope: scopeResolution.effectiveScope,
      queryMeta: {
        requestedScope: scopeResolution.requestedScope,
        effectiveScope: scopeResolution.effectiveScope,
        fallbackApplied: scopeResolution.fallbackApplied,
      },
    };

    if (isSeasonScope) {
      response.season = seasonId;
      response.window = 'month';
    }

    res.json(response);
  } catch (error) {
    console.error('Error al obtener leaderboard:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/leaderboard/me?scope=global|season
 */
router.get('/me', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const scopeResolution = resolveLeaderboardScope(req.query.scope);
    const context = await getUserLeaderboardContext(
      req.user!.userId,
      3,
      scopeResolution.effectiveScope
    );

    if (!context.userRank) {
      res.json({
        message: 'Aún no tienes puntaje en el ranking',
        userRank: null,
        neighbors: [],
        scope: scopeResolution.effectiveScope,
      });
      return;
    }

    res.json({
      userRank: context.userRank,
      neighbors: context.neighbors,
      scope: scopeResolution.effectiveScope,
    });
  } catch (error) {
    console.error('Error al obtener posición:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/leaderboard/stats
 */
router.get('/stats', async (_req, res: Response) => {
  try {
    const [stats, top3] = await Promise.all([getLeaderboardStats(), getTopLeaderboard(3)]);
    res.json({ ...stats, top3 });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/leaderboard/admin/rebuild
 *
 * Reconstruye retroactivamente el leaderboard a partir de los GameResult históricos:
 *   - Recomputa User.highScore para cada usuario
 *   - Repuebla Redis global
 *   - Repuebla Redis para cada temporada con actividad
 *
 * Protegido por header `x-admin-token` (compara con env ADMIN_TOKEN).
 * Si ADMIN_TOKEN no está seteado, el endpoint queda deshabilitado.
 *
 * Body opcional: { scope: 'global' | 'season' | 'all', seasonId?: 'YYYY-MM' }
 */
router.post('/admin/rebuild', async (req: Request, res: Response) => {
  const expected = config.adminToken;
  if (!expected) {
    res.status(404).json({ error: 'Endpoint no disponible' });
    return;
  }
  const provided = req.headers['x-admin-token'];
  if (provided !== expected) {
    res.status(401).json({ error: 'No autorizado' });
    return;
  }

  try {
    const scope = (req.body?.scope as string | undefined)?.toLowerCase() ?? 'all';
    const seasonId = (req.body?.seasonId as string | undefined) ?? undefined;

    if (scope === 'global') {
      const loaded = await syncLeaderboardFromDatabase();
      res.json({ ok: true, scope: 'global', loaded });
      return;
    }
    if (scope === 'season') {
      const loaded = await syncSeasonLeaderboardFromDatabase(seasonId);
      res.json({ ok: true, scope: 'season', seasonId: seasonId ?? getCurrentSeasonId(), loaded });
      return;
    }

    const result = await rebuildAllLeaderboards();
    res.json({ ok: true, scope: 'all', ...result });
  } catch (error) {
    console.error('Error al reconstruir leaderboard:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
