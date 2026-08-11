import { Router, Response } from 'express';
import { z } from 'zod';
import { Category, GameMode, GameVariant } from '@prisma/client';
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
  toPublicQuestion,
  createGameSession,
  getGameSession,
  storeAnswerResult,
  getStoredAnswerResult,
  extendGameSession,
  updateSessionToAuthenticated,
  recordMechanicUsage,
  recordMechanicUsageAtomic,
  AnswerResult,
  QuestionFilters,
  type GameQuestion,
  type SoloGameType,
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
import { AppError } from '../utils/appError.js';
import { respondWithError } from '../utils/respondWithError.js';
import { mapZodIssuesToFields } from '../utils/zodIssueMapper.js';
import { trackServerEvent } from '../services/telemetry.service.js';

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
  sessionId: z.string().optional(),
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
  sessionId: z.string().min(1),
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
  ).optional(),
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
        code: 'VALIDATION_FAILED',
        params: { fields: mapZodIssuesToFields(validation.error.errors) },
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
        code: 'GAME_NOT_ENOUGH_QUESTIONS',
        params: { available: questions.length, requested: expectedQuestions },
        available: questions.length,
        requested: expectedQuestions,
        canStartShortGame: gameType !== 'streak' && questions.length > 0,
      });
      return;
    }

    // Mapear gameType a variant para la sesión
    const variant: GameVariant =
      gameType === 'streak' ? GameVariant.STREAK
        : gameType === 'flash' ? GameVariant.FLASH
        : GameVariant.CLASSIC;

    // Crear sesión en Redis: guarda correctAnswers, nunca se envían al cliente
    const sessionId = await createGameSession({
      userId: req.user?.userId ?? null,
      gameMode: GameMode.SINGLE,
      variant,
      category,
      filters,
      questions,
    });

    trackServerEvent({
      name: 'game_started',
      userId: req.user?.userId ?? null,
      runId: sessionId,
      gameMode: GameMode.SINGLE,
      variant,
      category,
      properties: {
        questionCount: questions.length,
        filters: filters ? JSON.stringify(filters) : undefined,
      },
    });

    res.json({
      message: 'Partida iniciada',
      sessionId,
      gameConfig: {
        questionsCount: questions.length,
        timePerQuestion: config.game.timePerQuestion,
        category,
        gameType,
        mechanics: getMechanicsConfigForMode(gameType),
      },
      questions: questions.map(toPublicQuestion),
    });
  } catch (error) {
    respondWithError(res, error);
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
      res.status(400).json({
        error: 'Parámetros inválidos',
        code: 'VALIDATION_FAILED',
        params: { fields: mapZodIssuesToFields(validation.error.errors) },
        details: validation.error.errors,
      });
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
    respondWithError(res, error);
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
        code: 'GAME_INSUFFICIENT_QUESTIONS_SHORT',
        params: { available: questions.length },
        available: questions.length,
      });
      return;
    }

    const sessionId = await createGameSession({
      userId: req.user?.userId ?? null,
      gameMode: GameMode.SINGLE,
      variant: GameVariant.FLASH,
      category: flashCategory || Category.MIXED,
      questions,
    });

    trackServerEvent({
      name: 'game_started',
      userId: req.user?.userId ?? null,
      runId: sessionId,
      gameMode: GameMode.SINGLE,
      variant: GameVariant.FLASH,
      category: flashCategory || Category.MIXED,
      properties: { questionCount: questions.length },
    });

    res.json({
      message: 'Flash iniciado',
      sessionId,
      gameConfig: {
        questionsCount: questions.length,
        timePerQuestion: config.game.timePerQuestion,
        category: Category.MIXED,
        gameType: 'flash',
        durationSeconds: getFlashDurationSeconds(),
        mechanics: getMechanicsConfigForMode('flash'),
      },
      questions: questions.map(toPublicQuestion),
    });
  } catch (error) {
    respondWithError(res, error);
  }
});

/**
 * POST /api/game/extend-session
 * Extiende una sesión existente con más preguntas. Exclusivo de STREAK.
 */
router.post('/extend-session', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      sessionId: z.string().min(1),
    });
    const validation = schema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({ error: 'Parámetros inválidos', code: 'VALIDATION_FAILED' });
      return;
    }

    const { sessionId } = validation.data;

    const existingSession = await getGameSession(sessionId);
    if (!existingSession) {
      res.status(410).json({ error: 'Sesión expirada', code: 'GAME_SESSION_EXPIRED' });
      return;
    }

    if (existingSession.userId && (!req.user || existingSession.userId !== req.user!.userId)) {
      res.status(403).json({ error: 'Sesión no pertenece al usuario.', code: 'SESSION_MISMATCH' });
      return;
    }

    // Exclusivo de Streak
    if (existingSession.gameMode !== 'SINGLE' || existingSession.variant !== 'STREAK') {
      res.status(400).json({ error: 'extend-session solo disponible en modo Streak.', code: 'EXTEND_STREAK_ONLY' });
      return;
    }

    // Categoría y filtros derivados de la sesión, no del cliente
    const questions = await getQuestionsForStreakGame(
      existingSession.category as Category | undefined,
      existingSession.questionIds,
      3,
      [],
      existingSession.filters as QuestionFilters | undefined,
    );
    if (questions.length === 0) {
      res.status(409).json({ error: 'No hay más preguntas disponibles', code: 'GAME_NOT_ENOUGH_QUESTIONS' });
      return;
    }

    await extendGameSession(sessionId, questions);

    res.json({
      questions: questions.map(toPublicQuestion),
    });
  } catch (error) {
    respondWithError(res, error);
  }
});

/**
 * POST /api/game/answer
 * Server-authoritative. sessionId obligatorio. Primera respuesta inmutable.
 * Re-answer devuelve el resultado almacenado (idempotencia).
 */
router.post('/answer', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const validation = answerSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        code: 'VALIDATION_FAILED',
        params: { fields: mapZodIssuesToFields(validation.error.errors) },
        details: validation.error.errors,
      });
      return;
    }

    const { questionId, answer, timeRemaining, coordinates, sessionId } = validation.data;

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId es obligatorio.', code: 'SESSION_REQUIRED' });
      return;
    }

    const session = await getGameSession(sessionId);
    if (!session) {
      res.status(410).json({ error: 'La sesión expiró.', code: 'GAME_SESSION_EXPIRED' });
      return;
    }
    // Auth enforcement
    if (session.userId && (!req.user || session.userId !== req.user!.userId)) {
      res.status(403).json({ error: 'La sesión pertenece a otro usuario.', code: 'SESSION_MISMATCH' });
      return;
    }
    if (!session.questionIds.includes(questionId)) {
      res.status(400).json({ error: 'La pregunta no pertenece a esta partida.', code: 'GAME_INVALID_QUESTION' });
      return;
    }

    // Derivar gameType y scoring strategy del variant de sesión (nunca del cliente)
    const sessionGameType: SoloGameType =
      session.variant === 'STREAK' ? 'streak'
      : session.variant === 'FLASH' ? 'flash'
      : 'single';

    // Derivar combo Flash desde session.questionResults (historial server-side)
    let flashCombo: number | undefined;
    if (sessionGameType === 'flash') {
      let combo = 0;
      for (const qid of session.questionIds) {
        const r = session.questionResults[qid];
        if (!r) break;
        if (r.isCorrect) combo++; else combo = 0;
      }
      flashCombo = combo;
    }

    // Validar respuesta contra la sesión
    const result = await validateAnswerByGameType(
      questionId,
      answer,
      Math.min(Math.max(0, timeRemaining), 30),
      coordinates,
      sessionGameType,
      flashCombo !== undefined ? { combo: flashCombo } : undefined
    );

    // Almacenamiento atómico: SET NX previene race condition
    const { stored, isFirstAnswer } = await storeAnswerResult(sessionId, questionId, result);

    if (isFirstAnswer) {
      const distanceBucket = stored.distance !== undefined
        ? (stored.distance < 100 ? '<100km' : stored.distance < 500 ? '100-500km' : stored.distance < 1000 ? '500-1000km' : stored.distance < 2000 ? '1000-2000km' : '>2000km')
        : undefined;
      trackServerEvent({
        name: 'question_answered',
        userId: session.userId,
        runId: sessionId,
        questionId,
        gameMode: session.gameMode,
        variant: session.variant,
        category: session.questionMeta?.[questionId]?.category,
        properties: {
          isCorrect: stored.isCorrect,
          points: stored.points,
          timeRemaining: stored.timeRemaining,
          difficulty: session.questionMeta?.[questionId]?.difficulty,
          continent: session.questionMeta?.[questionId]?.continent,
          distanceBucket,
          roundIndex: session.answeredQuestionIds.length - 1,
        },
      });
    }

    res.json(stored);
  } catch (error) {
    respondWithError(res, error);
  }
});

/**
 * POST /api/game/mechanic
 * Server-authoritative: ejecuta mecánicas (50/50, focusTime) server-side.
 * Nunca expone la respuesta correcta.
 */
router.post('/mechanic', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      sessionId: z.string().min(1),
      questionId: z.string().min(1),
      mechanic: z.enum(['intel5050']),
    });
    const validation = schema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({ error: 'Datos inválidos', code: 'VALIDATION_FAILED' });
      return;
    }

    const { sessionId, questionId, mechanic } = validation.data;

    const session = await getGameSession(sessionId);
    if (!session) {
      res.status(410).json({ error: 'La sesión expiró. Inicia una nueva partida.', code: 'GAME_SESSION_EXPIRED' });
      return;
    }
    if (!session.questionIds.includes(questionId)) {
      res.status(400).json({ error: 'La pregunta no pertenece a esta partida.', code: 'GAME_INVALID_QUESTION' });
      return;
    }

    // Auth enforcement
    if (session.userId && (!req.user || session.userId !== req.user!.userId)) {
      res.status(403).json({ error: 'Sesión no pertenece al usuario.', code: 'SESSION_MISMATCH' });
      return;
    }

    // Variant check: mechanics not allowed for STREAK
    if (session.variant === 'STREAK') {
      res.status(400).json({ error: 'Mecánicas no disponibles en este modo.', code: 'MECHANIC_VARIANT_REJECTED' });
      return;
    }

    // Post-answer check: mechanic not allowed after answering
    if (session.answeredQuestionIds.includes(questionId)) {
      res.status(400).json({ error: 'No puedes usar mecánicas después de responder.', code: 'MECHANIC_POST_ANSWER' });
      return;
    }

    // Atomic counter para 50/50: no puede usarse más de {max} veces.
    const usage = await recordMechanicUsageAtomic(sessionId, mechanic, questionId);
    if (!usage.allowed) {
      res.status(400).json({ error: 'Mecánica agotada.', code: 'MECHANIC_UNAVAILABLE' });
      return;
    }

    trackServerEvent({
      name: 'mechanic_used',
      userId: session.userId,
      runId: sessionId,
      questionId,
      gameMode: session.gameMode,
      variant: session.variant,
      category: session.questionMeta?.[questionId]?.category,
      properties: {
        mechanic,
        remaining: usage.remaining,
      },
    });

    // Usar las opciones en el orden exacto que ve el cliente (almacenadas en la sesión)
    const options = session.optionsPerQuestion[questionId];
    if (!options) {
      res.status(400).json({ error: 'Opciones no encontradas en la sesión.', code: 'GAME_INVALID_QUESTION' });
      return;
    }

    const correctAnswer = session.correctAnswers[questionId];
    const incorrectIndexes = options
      .map((opt: string, idx: number) => ({ opt, idx }))
      .filter(({ opt }: { opt: string }) => opt.toLowerCase().trim() !== correctAnswer.toLowerCase().trim())
      .map(({ idx }: { idx: number }) => idx);

    const shuffled = [...incorrectIndexes].sort(() => Math.random() - 0.5);
    const hiddenOptionIndexes = shuffled.slice(0, Math.min(2, shuffled.length));

    res.json({
      mechanic,
      hiddenOptionIndexes,
      remaining: usage.remaining,
    });
  } catch (error) {
    respondWithError(res, error);
  }
});

/**
 * POST /api/game/finish
 * Terminar partida y guardar resultado. Deriva preguntas y resultados de la sesión.
 */
router.post('/finish', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const validation = finishGameSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        code: 'VALIDATION_FAILED',
        params: { fields: mapZodIssuesToFields(validation.error.errors) },
        details: validation.error.errors,
      });
      return;
    }

    const { sessionId } = validation.data;

    if (!sessionId) {
      res.status(400).json({ error: 'sessionId es obligatorio.', code: 'SESSION_REQUIRED' });
      return;
    }

    const session = await getGameSession(sessionId);
    if (!session) {
      res.status(410).json({ error: 'La sesión expiró. Inicia una nueva partida.', code: 'GAME_SESSION_EXPIRED' });
      return;
    }
    if (session.userId && session.userId !== req.user!.userId) {
      res.status(403).json({ error: 'La sesión pertenece a otro usuario.', code: 'SESSION_MISMATCH' });
      return;
    }

    // Vincular sesión al usuario si aún no lo estaba (start antes del login)
    await updateSessionToAuthenticated(sessionId, req.user!.userId);

    // Derivar resultados de la sesión, no del body del cliente
    const results: AnswerResult[] = [];
    for (const questionId of session.questionIds) {
      const stored = session.questionResults[questionId];
      if (stored) {
        results.push(stored);
      }
    }

    const category = session.category;
    const variant = session.variant;

    // Guardar resultado
    const { gameId, totalScore, isHighScore } = await saveGameResult(
      req.user!.userId,
      results,
      variant,
      session.gameMode,
      category,
      undefined,
      session.sessionId, // runId = sessionId para idempotencia
    );

    // Calcular estadísticas
    const correctCount = results.filter((r) => r.isCorrect).length;
    const accuracy = results.length > 0 ? Math.round((correctCount / results.length) * 100) : 0;

    trackServerEvent({
      name: 'game_finished',
      userId: req.user!.userId,
      runId: sessionId,
      gameMode: session.gameMode,
      variant,
      category,
      properties: {
        score: totalScore,
        correctCount,
        totalQuestions: results.length,
        accuracy,
      },
    });

    // Actualizar leaderboards (Redis); solo Classic participa en el ranking global.
    if (variant === GameVariant.CLASSIC) {
      await Promise.all([
        updateLeaderboardScore(req.user!.userId, totalScore),
        updateSeasonLeaderboardScore(req.user!.userId, totalScore),
      ]);
    }

    // Evaluar achievements
    const streakLength = variant === GameVariant.STREAK ? correctCount : undefined;
    const newAchievements = await evaluateAchievementsAfterGame({
      userId: req.user!.userId,
      correctCount,
      totalQuestions: results.length,
      score: totalScore,
      streakLength,
      isStreakMode: variant === GameVariant.STREAK,
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
    respondWithError(res, error);
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
    respondWithError(res, error);
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
    respondWithError(res, error);
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
    respondWithError(res, error);
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
    respondWithError(res, error);
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
    respondWithError(res, error);
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
    respondWithError(res, error);
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
    respondWithError(res, error);
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

function dayKeyToUtcMidnight(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00.000Z`).getTime();
}

function addDaysToKey(dayKey: string, days: number): string {
  const date = new Date(dayKeyToUtcMidnight(dayKey));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const CLIENT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CLIENT_DATE_MAX_DRIFT_DAYS = 1;

/**
 * Resuelve el "día" a usar para el gate de racha diaria. El servidor corre en
 * UTC; un usuario en UTC-4 jugando a las 23:30 local puede caer ya en
 * "mañana" en UTC y perder su racha aunque haya jugado todos los días reales.
 *
 * `clientDate` (YYYY-MM-DD, fecha calendario LOCAL del dispositivo) permite
 * corregir eso. Se acepta sólo si:
 *  - tiene el formato correcto y parsea a una fecha real, Y
 *  - está a ±1 día calendario de la fecha UTC del servidor (evita spoofing
 *    para gamear la racha).
 * Si es inválido, falta, o está fuera de rango: se ignora silenciosamente y
 * se usa el fallback UTC de siempre (nunca 400 — clientes viejos cacheados
 * de la PWA no mandan este parámetro).
 */
function resolveDayKey(clientDate: unknown): string {
  const serverToday = getTodayKey();

  if (typeof clientDate !== 'string' || !CLIENT_DATE_PATTERN.test(clientDate)) {
    return serverToday;
  }

  const parsedMs = dayKeyToUtcMidnight(clientDate);
  if (Number.isNaN(parsedMs)) {
    return serverToday;
  }

  // Re-serializar y comparar el string: rechaza fechas "reales" pero mal
  // formateadas por JS Date (p.ej. 2026-02-30 → rueda a marzo).
  if (new Date(parsedMs).toISOString().slice(0, 10) !== clientDate) {
    return serverToday;
  }

  const serverTodayMs = dayKeyToUtcMidnight(serverToday);
  const driftDays = Math.round((parsedMs - serverTodayMs) / (24 * 60 * 60 * 1000));

  if (Math.abs(driftDays) > CLIENT_DATE_MAX_DRIFT_DAYS) {
    return serverToday;
  }

  return clientDate;
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
    // `today` (UTC) sigue siendo la clave del set de preguntas: determinista y
    // compartida por todos los usuarios, no debe moverse con la fecha local
    // del cliente. `dayKey` es la fecha usada para el gate "¿ya jugó?" del
    // usuario — ahí sí preferimos su calendario local si es válido.
    const today = getTodayKey();
    const dayKey = resolveDayKey(req.query.clientDate);
    const redis = getRedis();
    const cacheKey = `daily:questions:${today}`;
    const userId = req.user?.userId;
    let redisDown = false;

    // ¿Ya jugó hoy? Redis es el camino rápido; DB es el fallback.
    if (userId) {
      const playedKey = `daily:played:${userId}:${dayKey}`;
      try {
        const existing = await redis.get(playedKey);
        if (existing) {
          res.json({ alreadyPlayed: true, result: JSON.parse(existing), today: dayKey });
          return;
        }
      } catch {
        redisDown = true;
        const played = await getDailyResultFromDb(userId, dayKey);
        if (played) {
          res.json({ alreadyPlayed: true, result: played, today: dayKey });
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
      imageUrl: q.imageUrl,
      questionData: q.questionData,
      continent: q.continent,
      subregion: q.subregion,
      isInsular: q.isInsular,
      isLandlocked: q.isLandlocked,
      populationTier: q.populationTier,
      areaTier: q.areaTier,
    }));

    if (userId) {
      const runId = `daily:${userId}:${dayKey}`;
      trackServerEvent({
        name: 'game_started',
        userId,
        runId,
        gameMode: GameMode.SINGLE,
        variant: GameVariant.DAILY,
        category: Category.MIXED,
        properties: { questionCount: questionIds.length, dayKey },
      });
    }

    res.json({ questions: formatted, today: dayKey, alreadyPlayed: false });
  } catch (error) {
    respondWithError(res, error);
  }
});

/**
 * POST /api/game/daily/answer
 * Respuesta individual del Daily. Primera respuesta inmutable, atómica.
 */
router.post('/daily/answer', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({ questionId: z.string().min(1), answer: z.string(), clientDate: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }

    const { questionId, answer } = parsed.data;
    const today = getTodayKey();
    const redis = getRedis();
    const userId = req.user!.userId;

    let questionIds: string[] = [];
    try {
      const cached = await redis.get(`daily:questions:${today}`);
      if (cached) questionIds = JSON.parse(cached);
    } catch {}
    if (questionIds.length === 0) questionIds = await generateDailyQuestionIds(today);
    if (!questionIds.includes(questionId)) { res.status(400).json({ error: 'Pregunta inválida' }); return; }

    const answerKey = `daily:answer:${userId}:${today}:${questionId}`;
    const existing = await redis.get(answerKey);
    if (existing) { res.json(JSON.parse(existing) as Record<string, unknown>); return; }

    const q = await prisma.question.findUnique({ where: { id: questionId }, select: { correctAnswer: true } });
    if (!q) { res.status(400).json({ error: 'Pregunta no encontrada' }); return; }

    const isCorrect = answer.trim().toLowerCase() === q.correctAnswer.toLowerCase().trim();
    const candidate = { questionId, isCorrect, correctAnswer: q.correctAnswer, points: isCorrect ? 100 : 0 };

    const nxResult = await redis.set(answerKey, JSON.stringify(candidate), 'EX', DAILY_TTL_SECONDS, 'NX');
    if (nxResult === 'OK') {
      const runId = `daily:${userId}:${resolveDayKey(parsed.data.clientDate)}`;
      trackServerEvent({
        name: 'question_answered',
        userId,
        runId,
        questionId,
        gameMode: GameMode.SINGLE,
        variant: GameVariant.DAILY,
        properties: { isCorrect, points: candidate.points },
      });
      res.json(candidate); return;
    }

    const winner = await redis.get(answerKey);
    if (winner) { res.json(JSON.parse(winner) as Record<string, unknown>); return; }

    res.status(503).json({ error: 'Servicio no disponible.', code: 'GAME_STATE_UNAVAILABLE' });
  } catch {
    res.status(503).json({ error: 'Servicio no disponible.', code: 'GAME_STATE_UNAVAILABLE' });
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
  // Fecha calendario LOCAL del dispositivo (YYYY-MM-DD). Opcional y no confiable
  // por sí sola — resolveDayKey() la descarta si está mal formada o muy alejada
  // de la fecha UTC del servidor.
  clientDate: z.string().optional(),
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
      res.status(400).json({
        error: 'Datos inválidos',
        code: 'VALIDATION_FAILED',
        params: { fields: mapZodIssuesToFields(parsed.error.errors) },
      });
      return;
    }
    const { answers, clientDate } = parsed.data;
    // `today` (UTC) sigue siendo la clave del set de preguntas determinista.
    // `dayKey` es la fecha usada para el gate de idempotencia y la racha del
    // usuario — preferimos su calendario local si `clientDate` es válido.
    const today = getTodayKey();
    const dayKey = resolveDayKey(clientDate);
    const redis = getRedis();
    const userId = req.user!.userId;
    const playedKey = `daily:played:${userId}:${dayKey}`;

    // Idempotencia: Redis es el camino rápido. Si Redis está caído, la guardia
    // es User.lastDailyDate === dayKey (verificada justo abajo).
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

    // Consolidar respuestas stored de /daily/answer (ignorar body del cliente)
    let correctCount = 0;
    let totalAnswered = 0;
    for (const qid of questionIds) {
      const stored = await redis.get(`daily:answer:${userId}:${today}:${qid}`);
      if (stored === null) continue; // key inexistente = unanswered → incorrecta
      // key exists or error → parse
      const a = JSON.parse(stored) as { isCorrect: boolean };
      if (a.isCorrect) correctCount++;
      totalAnswered++;
    }
    const score = correctCount * DAILY_POINTS_PER_CORRECT;
    const totalQuestions = questionIds.length;

    // Update daily streak in DB
    const userRow = await prisma.user.findUnique({
      where: { id: userId },
      select: { highScore: true, dailyStreak: true, lastDailyDate: true },
    });

    // Reenvío del mismo día (p.ej. Redis caído saltó la idempotencia anterior):
    // no recontar la partida ni resetear la racha.
    if (userRow?.lastDailyDate === dayKey) {
      const previous = await getDailyResultFromDb(userId, dayKey);
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

    const yesterdayKey = addDaysToKey(dayKey, -1);
    const previousStreak = userRow?.dailyStreak ?? 0;
    const isContinuingStreak = userRow?.lastDailyDate === yesterdayKey;
    const newStreak = isContinuingStreak ? previousStreak + 1 : 1;
    // Sólo marcamos "perdida" una racha que valía la pena flaggear (>=2):
    // perder una racha de 1 día no es una pérdida notable para el usuario.
    const streakLost = !isContinuingStreak && userRow?.lastDailyDate != null && previousStreak >= 2;

    const updateData: Record<string, unknown> = {
      dailyStreak: newStreak,
      lastDailyDate: dayKey,
      gamesPlayed: { increment: 1 },
    };
    // Daily NO actualiza highScore (legacy: exclusivo de Single Classic).

    // Atómico: o queda el usuario actualizado Y el resultado en el historial, o nada.
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: updateData });
      await tx.gameResult.create({
        data: { userId, score, correctCount, totalQuestions, gameMode: 'SINGLE', variant: GameVariant.DAILY, category: 'MIXED' },
      });
    });

    const runId = `daily:${userId}:${dayKey}`;
    trackServerEvent({
      name: 'game_finished',
      userId,
      runId,
      gameMode: GameMode.SINGLE,
      variant: GameVariant.DAILY,
      category: Category.MIXED,
      properties: {
        score,
        correctCount,
        totalQuestions,
        dailyStreak: newStreak,
        dayKey,
      },
    });

    const result: Record<string, unknown> = {
      score,
      correctCount,
      totalQuestions,
      dailyStreak: newStreak,
      playedAt: new Date().toISOString(),
    };
    if (streakLost) {
      result.previousStreak = previousStreak;
      result.streakLost = true;
    }

    try {
      await redis.set(playedKey, JSON.stringify(result), 'EX', DAILY_TTL_SECONDS);
    } catch {
      // best-effort: User.lastDailyDate ya quedó persistido como fuente de verdad
    }

    // Daily NO participa en el ranking global (solo Classic Single).

    // Evaluate achievements
    const newAchievements = await evaluateAchievementsAfterDaily(userId, newStreak).catch(() => []);

    res.json({ result, newAchievements, message: 'Resultado guardado' });
  } catch (error) {
    respondWithError(res, error);
  }
});

export default router;
