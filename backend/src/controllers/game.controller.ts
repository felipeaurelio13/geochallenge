import { Router, Response } from 'express';
import { z } from 'zod';
import { Category, GameMode } from '@prisma/client';
import { authenticateJWT, optionalAuth, AuthRequest } from '../middleware/auth.js';
import {
  getQuestionsForGame,
  getQuestionsForStreakGame,
  getStreakBatchSize,
  getQuestionsForFlashGame,
  getAvailableQuestionsCount,
  getFlashDurationSeconds,
  getMechanicsConfigForMode,
  validateAnswerByGameType,
  saveGameResult,
  getUserGameHistory,
  getDuelMatchHistory,
  getDuelMatchStats,
  getDuelOpponents,
  getDuelHeadToHead,
  getCategoryStats,
  generateQuestionText,
  AnswerResult,
  QuestionFilters,
} from '../services/game.service.js';
import { shuffleArray } from '../utils/scoring.js';
import { getRedis } from '../config/redis.js';
import { prisma } from '../config/database.js';
import {
  evaluateAchievementsAfterGame,
  evaluateAchievementsAfterDaily,
  getUserAchievements,
} from '../services/achievement.service.js';
import { updateLeaderboardScore, updateSeasonLeaderboardScore } from '../services/leaderboard.service.js';
import { config } from '../config/env.js';

const router = Router();
const gameTypeSchema = z.enum(['single', 'streak', 'flash']);

const excludeIdsSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => String(item).trim())
        .filter(Boolean);
    }

    return [];
  },
  z.array(z.string())
);

const difficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']);

const questionFiltersSchema = z.object({
  continent: z.string().optional(),
  isInsular: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  isLandlocked: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  difficulty: difficultySchema.optional(),
});

function parseFilters(raw: Record<string, unknown>): QuestionFilters | undefined {
  const result = questionFiltersSchema.safeParse(raw);
  if (!result.success) return undefined;
  const { continent, isInsular, isLandlocked, difficulty } = result.data;
  if (!continent && isInsular === undefined && isLandlocked === undefined && !difficulty) return undefined;
  return { continent, isInsular, isLandlocked, difficulty: difficulty as QuestionFilters['difficulty'] };
}

// Schema de validación
export const startGameSchema = z.object({
  category: z.nativeEnum(Category).optional().default(Category.MIXED),
  questionCount: z.coerce.number().min(5).max(20).optional().default(config.game.questionsPerGame),
  gameType: gameTypeSchema.optional().default('single'),
  excludeIds: excludeIdsSchema.optional().default([]),
  excludeQuestionKeys: excludeIdsSchema.optional().default([]),
  // Filters
  continent: z.string().optional(),
  isInsular: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  isLandlocked: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  difficulty: difficultySchema.optional(),
  acceptShortGame: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
});

const answerSchema = z.object({
  questionId: z.string(),
  answer: z.string(),
  timeRemaining: z.number().min(0).max(config.game.timePerQuestion),
  gameType: gameTypeSchema.optional().default('single'),
  combo: z.number().int().min(0).max(200).optional(),
  mechanicUsage: z
    .object({
      key: z.enum(['intel5050', 'focusTime', 'streakShield']),
      action: z.literal('trigger'),
      questionId: z.string().optional(),
      roundIndex: z.number().int().min(0).optional(),
      value: z.number().optional(),
    })
    .optional(),
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});

const finishGameSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      answer: z.string(),
      timeRemaining: z.number(),
      coordinates: z
        .object({
          lat: z.number(),
          lng: z.number(),
        })
        .optional(),
    })
  ),
  gameType: gameTypeSchema.optional().default('single'),
  category: z.nativeEnum(Category).optional(),
});

/**
 * GET /api/game/start
 * Iniciar nueva partida - obtener preguntas
 */
router.get('/start', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = startGameSchema.safeParse(req.query);

    if (!validation.success) {
      res.status(400).json({
        error: 'Parámetros inválidos',
        details: validation.error.errors,
      });
      return;
    }

    const { category, questionCount, gameType, excludeIds, excludeQuestionKeys, acceptShortGame } = validation.data;
    const filters = parseFilters(validation.data as Record<string, unknown>);
    const expectedQuestions = gameType === 'streak'
      ? getStreakBatchSize(questionCount)
      : questionCount;

    const questions = gameType === 'streak'
      ? await getQuestionsForStreakGame(category, excludeIds, questionCount, excludeQuestionKeys, filters)
      : await getQuestionsForGame(category, questionCount, excludeIds, filters);

    const canServeReducedSet = gameType !== 'streak' && acceptShortGame === true && questions.length > 0;

    if (questions.length < expectedQuestions && !canServeReducedSet) {
      res.status(409).json({
        error: 'No hay suficientes preguntas disponibles',
        available: questions.length,
        requested: expectedQuestions,
        canStartShortGame: gameType !== 'streak' && questions.length > 0,
      });
      return;
    }

    res.json({
      message: 'Partida iniciada',
      gameConfig: {
        questionsCount: questions.length,
        timePerQuestion: config.game.timePerQuestion,
        category,
        gameType,
        mechanics: getMechanicsConfigForMode(gameType),
      },
      questions,
    });
  } catch (error) {
    console.error('Error al iniciar partida:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const flashStartSchema = z.object({
  category: z.nativeEnum(Category).optional(),
  continent: z.string().optional(),
  isInsular: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  isLandlocked: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  difficulty: difficultySchema.optional(),
});

const availabilitySchema = z.object({
  category: z.nativeEnum(Category).optional().default(Category.MIXED),
  questionCount: z.coerce.number().min(1).max(20).optional().default(config.game.questionsPerGame),
  continent: z.string().optional(),
  isInsular: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  isLandlocked: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  difficulty: difficultySchema.optional(),
});

router.get('/availability', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = availabilitySchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({ error: 'Parámetros inválidos', details: validation.error.errors });
      return;
    }

    const { category, questionCount } = validation.data;
    const filters = parseFilters(validation.data as Record<string, unknown>);
    const available = await getAvailableQuestionsCount(category, filters);

    res.json({
      available,
      required: questionCount,
      canPlay: available >= questionCount,
    });
  } catch (error) {
    console.error('Error al consultar disponibilidad:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/game/flash/start
 * Inicia una sesión Flash: 60 preguntas visuales, 2 opciones.
 */
router.get('/flash/start', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = flashStartSchema.safeParse(req.query);
    const flashCategory = validation.success ? validation.data.category : undefined;
    const flashFilters = validation.success ? parseFilters(validation.data as Record<string, unknown>) : undefined;
    const questions = await getQuestionsForFlashGame(flashCategory, flashFilters);
    if (questions.length < 10) {
      res.status(503).json({
        error: 'No hay suficientes preguntas visuales disponibles',
        available: questions.length,
      });
      return;
    }

    res.json({
      message: 'Flash iniciado',
      gameConfig: {
        questionsCount: questions.length,
        timePerQuestion: config.game.timePerQuestion,
        category: Category.MIXED,
        gameType: 'flash',
        durationSeconds: getFlashDurationSeconds(),
        mechanics: getMechanicsConfigForMode('flash'),
      },
      questions,
    });
  } catch (error) {
    console.error('Error al iniciar flash:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/game/answer
 * Validar una respuesta individual
 */
router.post('/answer', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = answerSchema.safeParse(req.body);

    if (!validation.success) {
      console.error('Answer validation failed:', {
        body: req.body,
        errors: validation.error.errors,
      });
      res.status(400).json({
        error: 'Datos inválidos',
        details: validation.error.errors,
        debug: process.env.NODE_ENV !== 'production' ? { timeRemaining: req.body.timeRemaining } : undefined,
      });
      return;
    }

    const { questionId, answer, timeRemaining, coordinates, gameType, combo } = validation.data;

    const result = await validateAnswerByGameType(
      questionId,
      answer,
      timeRemaining,
      coordinates,
      gameType,
      combo !== undefined ? { combo } : undefined
    );

    res.json(result);
  } catch (error) {
    console.error('Error al validar respuesta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/game/finish
 * Terminar partida y guardar resultado
 */
router.post('/finish', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const validation = finishGameSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        details: validation.error.errors,
      });
      return;
    }

    const { answers, category, gameType } = validation.data;

    // Validar todas las respuestas
    const results: AnswerResult[] = [];
    for (const answer of answers) {
      const result = await validateAnswerByGameType(
        answer.questionId,
        answer.answer,
        answer.timeRemaining,
        answer.coordinates,
        gameType
      );
      results.push(result);
    }

    // Guardar resultado
    const { gameId, totalScore, isHighScore } = await saveGameResult(
      req.user!.userId,
      results,
      category,
      GameMode.SINGLE
    );

    // Actualizar leaderboards (Redis); ambas funciones son idempotentes (max-only).
    await Promise.all([
      updateLeaderboardScore(req.user!.userId, totalScore),
      updateSeasonLeaderboardScore(req.user!.userId, totalScore),
    ]);

    // Calcular estadísticas
    const correctCount = results.filter((r) => r.isCorrect).length;
    const accuracy = Math.round((correctCount / results.length) * 100);

    // Evaluar achievements (sin bloquear la respuesta)
    const streakLength = gameType === 'streak' ? correctCount : undefined;
    const newAchievements = await evaluateAchievementsAfterGame({
      userId: req.user!.userId,
      correctCount,
      totalQuestions: results.length,
      score: totalScore,
      streakLength,
      isStreakMode: gameType === 'streak',
    }).catch(() => []);

    res.json({
      message: 'Partida finalizada',
      gameId,
      totalScore,
      correctCount,
      totalQuestions: results.length,
      accuracy,
      isHighScore,
      details: results,
      newAchievements,
    });
  } catch (error) {
    console.error('Error al finalizar partida:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/game/history
 * Historial de partidas del usuario
 */
router.get('/history', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 100);
    const history = await getUserGameHistory(req.user!.userId, limit);

    res.json({ history });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/game/duel-history
 * Historial de duelos paginado, filtrado por período
 */
router.get('/duel-history', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const period = (['week', 'month', 'year', 'all'].includes(req.query.period as string)
      ? req.query.period
      : 'all') as 'week' | 'month' | 'year' | 'all';
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize as string) || 20, 1), 50);

    const result = await getDuelMatchHistory(req.user!.userId, period, page, pageSize);
    res.json(result);
  } catch (error) {
    console.error('Error al obtener historial de duelos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/game/duel-stats
 * Estadísticas W/D/L del usuario por período
 */
router.get('/duel-stats', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await getDuelMatchStats(req.user!.userId);
    res.json(stats);
  } catch (error) {
    console.error('Error al obtener estadísticas de duelos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/game/duel-opponents
 * Lista de oponentes del usuario, con búsqueda opcional
 */
router.get('/duel-opponents', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const search = typeof req.query.search === 'string' && req.query.search.trim()
      ? req.query.search.trim()
      : undefined;
    const opponents = await getDuelOpponents(req.user!.userId, search);
    res.json({ opponents });
  } catch (error) {
    console.error('Error al obtener oponentes de duelos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/game/duel-h2h/:opponentId
 * Estadísticas head-to-head contra un oponente específico
 */
router.get('/duel-h2h/:opponentId', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { opponentId } = req.params;
    const data = await getDuelHeadToHead(req.user!.userId, opponentId);
    if (!data) {
      res.status(404).json({ error: 'Oponente no encontrado' });
      return;
    }
    res.json(data);
  } catch (error) {
    console.error('Error al obtener head-to-head:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/game/achievements
 * Logros del usuario
 */
router.get('/achievements', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const achievements = await getUserAchievements(req.user!.userId);
    res.json({ achievements });
  } catch (error) {
    console.error('Error al obtener logros:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/game/category-stats
 * Precisión del usuario por categoría (sólo partidas SINGLE y STREAK).
 */
router.get('/category-stats', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await getCategoryStats(req.user!.userId);
    res.json({ stats });
  } catch (error) {
    console.error('Error al obtener estadísticas por categoría:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── Daily Challenge ───────────────────────────────────────────────────────────

const DAILY_QUESTION_COUNT = 10;
const DAILY_TTL_SECONDS = 60 * 60 * 50; // 50h — survives past midnight safely
// El daily usa scoring simple (sin bonus de tiempo); espejo de DailyChallengePage.
const DAILY_POINTS_PER_CORRECT = 100;

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = ((s * 1664525) + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generación determinista de las preguntas del día: misma lista para todos
 * los usuarios y reproducible sin Redis (la caché es solo una optimización).
 * El submit la usa para validar que las respuestas correspondan al reto real.
 */
async function generateDailyQuestionIds(today: string): Promise<string[]> {
  const seed = parseInt(today.replace(/-/g, ''), 10);
  const allIds = await prisma.question.findMany({
    where: {
      isAvailable: true,
      category: { in: ['FLAG', 'CAPITAL', 'SILHOUETTE', 'MONUMENT', 'CINEMA_GEO'] },
    },
    select: { id: true },
  });
  const shuffled = seededShuffle(allIds.map((q) => q.id), seed);
  return shuffled.slice(0, DAILY_QUESTION_COUNT);
}

/**
 * Fallback cuando Redis no responde: reconstruye el resultado del reto diario
 * desde DB. User.lastDailyDate marca si el usuario jugó hoy; el GameResult más
 * reciente del día recupera el detalle de score/aciertos.
 */
async function getDailyResultFromDb(userId: string, today: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastDailyDate: true, dailyStreak: true },
  });
  if (user?.lastDailyDate !== today) return null;
  const last = await prisma.gameResult.findFirst({
    where: { userId, createdAt: { gte: new Date(`${today}T00:00:00.000Z`) } },
    orderBy: { createdAt: 'desc' },
    select: { score: true, correctCount: true, totalQuestions: true, createdAt: true },
  });
  return {
    score: last?.score ?? 0,
    correctCount: last?.correctCount ?? 0,
    totalQuestions: last?.totalQuestions ?? DAILY_QUESTION_COUNT,
    dailyStreak: user.dailyStreak ?? undefined,
    playedAt: (last?.createdAt ?? new Date()).toISOString(),
  };
}

/**
 * GET /api/game/daily
 * Retorna las preguntas del reto del día (mismas para todos los usuarios).
 * Si el usuario ya jugó hoy, retorna sus resultados previos.
 *
 * Redis es sólo una optimización: seededShuffle es determinista sobre la fecha,
 * así que las preguntas se regeneran sin caché, y el gate "ya jugó hoy" cae a
 * User.lastDailyDate. El reto diario sobrevive una caída de Redis en vez de
 * tirar un 500 que deja al jugador sin poder jugar.
 */
router.get('/daily', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const today = getTodayKey();
    const redis = getRedis();
    const cacheKey = `daily:questions:${today}`;
    const userId = req.user?.userId;
    let redisDown = false;

    // ¿Ya jugó hoy? Redis es el camino rápido; DB es el fallback.
    if (userId) {
      const playedKey = `daily:played:${userId}:${today}`;
      try {
        const existing = await redis.get(playedKey);
        if (existing) {
          res.json({ alreadyPlayed: true, result: JSON.parse(existing), today });
          return;
        }
      } catch {
        redisDown = true;
        const played = await getDailyResultFromDb(userId, today);
        if (played) {
          res.json({ alreadyPlayed: true, result: played, today });
          return;
        }
      }
    }

    // Preguntas del día: caché si Redis responde, generación determinista si no.
    let questionIds: string[] = [];
    if (!redisDown) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) questionIds = JSON.parse(cached);
      } catch {
        redisDown = true;
      }
    }

    if (questionIds.length === 0) {
      questionIds = await generateDailyQuestionIds(today);
      if (!redisDown) {
        try {
          await redis.set(cacheKey, JSON.stringify(questionIds), 'EX', DAILY_TTL_SECONDS);
        } catch {
          // caché best-effort: la generación determinista cubre el caso
        }
      }
    }

    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
    });

    // Preserve the daily order
    const ordered = questionIds
      .map((id) => questions.find((q) => q.id === id))
      .filter(Boolean) as typeof questions;

    const formatted = ordered.map((q) => ({
      id: q.id,
      category: q.category,
      questionText: generateQuestionText(q),
      options: shuffleArray(q.options),
      correctAnswer: q.correctAnswer,
      imageUrl: q.imageUrl,
      questionData: q.questionData,
      continent: q.continent,
      subregion: q.subregion,
      isInsular: q.isInsular,
      isLandlocked: q.isLandlocked,
      populationTier: q.populationTier,
      areaTier: q.areaTier,
    }));

    res.json({ questions: formatted, today, alreadyPlayed: false });
  } catch (error) {
    console.error('Error al obtener el reto del día:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// El cliente manda sus respuestas, NUNCA el puntaje: el servidor las valida
// contra las preguntas reales del día (deterministas) y calcula el score.
const dailySubmitSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(64),
        answer: z.string().max(200),
      })
    )
    .max(DAILY_QUESTION_COUNT),
});

/**
 * POST /api/game/daily/submit
 * Guarda el resultado del reto del día del usuario.
 */
router.post('/daily/submit', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    // Clientes con la versión anterior cacheada (PWA) mandan {score, correctCount}.
    if (!req.body?.answers && typeof req.body?.score === 'number') {
      res.status(400).json({
        error: 'Tu versión de la app está desactualizada. Recarga la página e intenta de nuevo.',
      });
      return;
    }

    const parsed = dailySubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos' });
      return;
    }
    const { answers } = parsed.data;
    const today = getTodayKey();
    const redis = getRedis();
    const userId = req.user!.userId;
    const playedKey = `daily:played:${userId}:${today}`;

    // Idempotencia: Redis es el camino rápido. Si Redis está caído, la guardia
    // es User.lastDailyDate === today (verificada justo abajo).
    try {
      const alreadySaved = await redis.get(playedKey);
      if (alreadySaved) {
        res.json({ message: 'Ya enviado', result: JSON.parse(alreadySaved) });
        return;
      }
    } catch {
      // Redis caído: seguimos con la guardia de DB.
    }

    // Validación server-side: las respuestas deben corresponder a las
    // preguntas reales del día, sin duplicados, y el score se recalcula acá.
    let questionIds: string[] = [];
    try {
      const cached = await redis.get(`daily:questions:${today}`);
      if (cached) questionIds = JSON.parse(cached);
    } catch {
      // Redis caído: la generación determinista cubre el caso.
    }
    if (questionIds.length === 0) {
      questionIds = await generateDailyQuestionIds(today);
    }

    const validIds = new Set(questionIds);
    const seen = new Set<string>();
    for (const a of answers) {
      if (!validIds.has(a.questionId) || seen.has(a.questionId)) {
        res.status(400).json({ error: 'Datos inválidos' });
        return;
      }
      seen.add(a.questionId);
    }

    const dailyQuestions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, correctAnswer: true },
    });
    const correctById = new Map(dailyQuestions.map((q) => [q.id, q.correctAnswer]));
    const correctCount = answers.filter((a) => a.answer === correctById.get(a.questionId)).length;
    const score = correctCount * DAILY_POINTS_PER_CORRECT;
    const totalQuestions = questionIds.length;

    // Update daily streak in DB
    const userRow = await prisma.user.findUnique({
      where: { id: userId },
      select: { highScore: true, dailyStreak: true, lastDailyDate: true },
    });

    // Reenvío del mismo día (p.ej. Redis caído saltó la idempotencia anterior):
    // no recontar la partida ni resetear la racha.
    if (userRow?.lastDailyDate === today) {
      const previous = await getDailyResultFromDb(userId, today);
      res.json({
        message: 'Ya enviado',
        result: previous ?? {
          score,
          correctCount,
          totalQuestions,
          dailyStreak: userRow.dailyStreak ?? 1,
          playedAt: new Date().toISOString(),
        },
      });
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().slice(0, 10);

    const newStreak =
      userRow?.lastDailyDate === yesterdayKey
        ? (userRow.dailyStreak ?? 0) + 1
        : 1;

    const updateData: Record<string, unknown> = {
      dailyStreak: newStreak,
      lastDailyDate: today,
      gamesPlayed: { increment: 1 },
    };
    if (userRow && score > (userRow.highScore ?? 0)) {
      updateData.highScore = score;
    }

    // Atómico: o queda el usuario actualizado Y el resultado en el historial, o nada.
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: updateData });
      await tx.gameResult.create({
        data: { userId, score, correctCount, totalQuestions, gameMode: 'SINGLE', category: 'MIXED' },
      });
    });

    const result = { score, correctCount, totalQuestions, dailyStreak: newStreak, playedAt: new Date().toISOString() };
    try {
      await redis.set(playedKey, JSON.stringify(result), 'EX', DAILY_TTL_SECONDS);
    } catch {
      // best-effort: User.lastDailyDate ya quedó persistido como fuente de verdad
    }

    // Update leaderboard (Redis): best-effort, pero logueado para observabilidad.
    await Promise.all([
      updateLeaderboardScore(userId, score),
      updateSeasonLeaderboardScore(userId, score),
    ]).catch((err) => {
      console.error(`[daily] leaderboard update failed for ${userId}:`, err);
    });

    // Evaluate achievements
    const newAchievements = await evaluateAchievementsAfterDaily(userId, newStreak).catch(() => []);

    res.json({ result, newAchievements, message: 'Resultado guardado' });
  } catch (error) {
    console.error('Error al guardar resultado diario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
