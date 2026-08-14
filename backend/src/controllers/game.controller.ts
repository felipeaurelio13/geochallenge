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
import { applyMasteryAttemptsForRun } from '../services/mastery.service.js';
import {
  getOrCreateDailyTour,
  DAILY_TOUR_VERSION,
  type DailyTourPlan,
  type DailyTourStop,
  type DailyTourRegion,
  toPublicDailyTour,
} from '../services/dailyTour.service.js';
import { hashString, seededShuffle } from '../utils/hash.js';
import { Difficulty } from '@prisma/client';

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
  gameType: z.string().optional(),
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

    // Variant check: mechanics not allowed for STREAK or PRACTICE
    if (session.variant === 'STREAK' || session.variant === 'PRACTICE') {
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

// ─── Daily Challenge (World Tour) ──────────────────────────────────────────

const DAILY_TTL_SECONDS = 60 * 60 * 50; // 50h
const DAILY_POINTS_PER_CORRECT = 100;

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
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

function resolveDayKey(clientDate: unknown): string {
  const serverToday = getTodayKey();

  if (typeof clientDate !== 'string' || !CLIENT_DATE_PATTERN.test(clientDate)) {
    return serverToday;
  }

  const parsedMs = dayKeyToUtcMidnight(clientDate);
  if (Number.isNaN(parsedMs)) {
    return serverToday;
  }

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

/**
 * Fallback cuando Redis no responde: reconstruye el resultado del reto diario
 * desde DB usando runId como fuente primaria.
 */
async function getDailyResultFromDb(userId: string, dayKey: string) {
  const runId = `daily:${userId}:${dayKey}`;
  const gr = await prisma.gameResult.findUnique({
    where: { runId },
    select: { score: true, correctCount: true, totalQuestions: true, createdAt: true, details: true },
  });
  if (gr) {
    const details = (gr.details as { stops?: DailyTourStop[] } | null)?.stops;
    return {
      score: gr.score,
      correctCount: gr.correctCount,
      totalQuestions: gr.totalQuestions,
      playedAt: gr.createdAt.toISOString(),
      details: details ?? null,
    };
  }

  // Legacy fallback: before Plan 7, no runId existed
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastDailyDate: true, dailyStreak: true },
  });
  if (user?.lastDailyDate !== dayKey) return null;
  const last = await prisma.gameResult.findFirst({
    where: { userId, variant: GameVariant.DAILY },
    orderBy: { createdAt: 'desc' },
    select: { score: true, correctCount: true, totalQuestions: true, createdAt: true },
  });
  return {
    score: last?.score ?? 0,
    correctCount: last?.correctCount ?? 0,
    totalQuestions: last?.totalQuestions ?? 10,
    dailyStreak: user.dailyStreak ?? undefined,
    playedAt: (last?.createdAt ?? new Date()).toISOString(),
    details: null,
  };
}

/**
 * GET /api/game/daily/status
 * Consulta sólo el estado del reto diario sin generar preguntas, crear sesión
 * ni modificar DB. Respuesta ligera para el lobby.
 */
router.get('/daily/status', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const dayKey = resolveDayKey(req.query.clientDate);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastDailyDate: true, dailyStreak: true },
    });

    const completed = user?.lastDailyDate === dayKey;
    const dailyStreak = user?.dailyStreak ?? 0;

    const status: {
      today: string;
      completed: boolean;
      dailyStreak: number;
      result?: {
        score: number;
        correctCount: number;
        totalQuestions: number;
        playedAt: string;
      };
    } = {
      today: dayKey,
      completed,
      dailyStreak,
    };

    if (completed) {
      const redis = getRedis();
      const playedKey = `daily:played:${userId}:${dayKey}`;
      let redisResult: string | null = null;
      try {
        redisResult = await redis.get(playedKey);
      } catch {
        // Redis down → fallback to DB
      }

      if (redisResult) {
        const parsed = JSON.parse(redisResult) as {
          score: number;
          correctCount: number;
          totalQuestions: number;
          playedAt: string;
        };
        status.result = {
          score: parsed.score,
          correctCount: parsed.correctCount,
          totalQuestions: parsed.totalQuestions,
          playedAt: parsed.playedAt,
        };
      } else {
        const dbResult = await getDailyResultFromDb(userId, dayKey);
        if (dbResult) {
          status.result = {
            score: dbResult.score,
            correctCount: dbResult.correctCount,
            totalQuestions: dbResult.totalQuestions,
            playedAt: dbResult.playedAt,
          };
        }
      }
    }

    res.json(status);
  } catch (error) {
    respondWithError(res, error);
  }
});

/**
 * GET /api/game/daily
 * Retorna el plan World Tour del día. Si el usuario ya jugó, retorna resultado.
 * Nunca envía countryCode ni correctAnswer antes de responder.
 */
router.get('/daily', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const dayKey = resolveDayKey(req.query.clientDate);
    const userId = req.user?.userId;

    // ¿Ya jugó hoy?
    if (userId) {
      const playedKey = `daily:played:${userId}:${dayKey}`;
      try {
        const existing = await getRedis().get(playedKey);
        if (existing) {
          const parsed = JSON.parse(existing);
          res.json({
            alreadyPlayed: true,
            result: parsed,
            today: dayKey,
            dayKey,
            dailyVersion: DAILY_TOUR_VERSION,
          });
          return;
        }
      } catch {
        const played = await getDailyResultFromDb(userId, dayKey);
        if (played) {
          res.json({
            alreadyPlayed: true,
            result: played,
            today: dayKey,
            dayKey,
            dailyVersion: DAILY_TOUR_VERSION,
          });
          return;
        }
      }
    }

    // Obtener o crear el plan del día
    const plan = await getOrCreateDailyTour(dayKey);
    const publicTour = toPublicDailyTour(plan);

    // Fetch questions from DB using plan questionIds
    const questions = await prisma.question.findMany({
      where: { id: { in: plan.questionIds } },
    });

    // Preserve the daily order
    const ordered = plan.questionIds
      .map((id) => questions.find((q) => q.id === id))
      .filter(Boolean) as typeof questions;

    // Deterministic options shuffle per day+question
    const optionSeed = hashString(`${dayKey}:options`);
    const formatted = ordered.map((q, idx) => {
      const qSeed = hashString(`${dayKey}:${q.id}:options`);
      const shuffledOptions = seededShuffle([...q.options], qSeed);
      return {
        id: q.id,
        category: q.category,
        questionText: generateQuestionText(q),
        options: shuffledOptions,
        imageUrl: q.imageUrl,
        questionData: q.questionData,
        continent: q.continent,
        subregion: q.subregion,
        isInsular: q.isInsular,
        isLandlocked: q.isLandlocked,
        populationTier: q.populationTier,
        areaTier: q.areaTier,
      };
    });

    if (userId) {
      const runId = `daily:${userId}:${dayKey}`;
      trackServerEvent({
        name: 'game_started',
        userId,
        runId,
        gameMode: GameMode.SINGLE,
        variant: GameVariant.DAILY,
        category: Category.MIXED,
        properties: {
          dailyVersion: DAILY_TOUR_VERSION,
          dayKey,
          totalStops: plan.stops.length,
          regionCount: new Set(plan.stops.map((s) => s.region)).size,
        },
      });
    }

    res.json({
      questions: formatted,
      today: dayKey,
      dayKey,
      alreadyPlayed: false,
      dailyVersion: DAILY_TOUR_VERSION,
      tour: publicTour,
    });
  } catch (error) {
    respondWithError(res, error);
  }
});

/**
 * POST /api/game/daily/answer
 * Respuesta individual del Daily. Primera respuesta inmutable, atómica.
 * Acepta answer='' para timeouts. Retorna countryCode+region sólo después de responder.
 */
router.post('/daily/answer', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      questionId: z.string().min(1),
      answer: z.string(),
      dayKey: z.string().optional(),
      clientDate: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Datos inválidos' }); return; }

    const { questionId, answer } = parsed.data;
    const userId = req.user!.userId;
    const resolvedDayKey = parsed.data.dayKey
      ? parsed.data.dayKey
      : resolveDayKey(parsed.data.clientDate);
    const redis = getRedis();

    // Get the plan
    const plan = await getOrCreateDailyTour(resolvedDayKey);
    if (!plan.questionIds.includes(questionId)) {
      res.status(400).json({ error: 'Pregunta inválida' });
      return;
    }

    const stop = plan.stops.find((s) => s.questionId === questionId);
    if (!stop) {
      res.status(400).json({ error: 'Pregunta fuera del plan' });
      return;
    }

    const answerKey = `daily:answer:${userId}:${resolvedDayKey}:${questionId}`;
    const existing = await redis.get(answerKey);
    if (existing) {
      const parsed = JSON.parse(existing) as Record<string, unknown>;
      res.json(parsed);
      return;
    }

    const q = await prisma.question.findUnique({
      where: { id: questionId },
      select: { correctAnswer: true },
    });
    if (!q) { res.status(400).json({ error: 'Pregunta no encontrada' }); return; }

    const isCorrect = answer.trim().toLowerCase() === q.correctAnswer.toLowerCase().trim();
    const candidate = {
      questionId,
      isCorrect,
      correctAnswer: q.correctAnswer,
      points: isCorrect ? DAILY_POINTS_PER_CORRECT : 0,
      countryCode: stop.countryCode,
      region: stop.region,
    };

    const nxResult = await redis.set(answerKey, JSON.stringify(candidate), 'EX', DAILY_TTL_SECONDS, 'NX');
    if (nxResult === 'OK') {
      const runId = `daily:${userId}:${resolvedDayKey}`;
      trackServerEvent({
        name: 'question_answered',
        userId,
        runId,
        questionId,
        gameMode: GameMode.SINGLE,
        variant: GameVariant.DAILY,
        category: stop.category,
        properties: {
          dailyVersion: DAILY_TOUR_VERSION,
          stopIndex: plan.stops.indexOf(stop),
          category: stop.category,
          region: stop.region,
          difficulty: stop.difficulty,
          isCorrect,
          points: candidate.points,
        },
      });
      // Return safe response (no correctAnswer in public response, but we include it for the immediate feedback)
      const { correctAnswer: _ca, ...safeResponse } = candidate;
      res.json({ ...safeResponse, correctAnswer: q.correctAnswer });
      return;
    }

    const winner = await redis.get(answerKey);
    if (winner) { res.json(JSON.parse(winner) as Record<string, unknown>); return; }

    res.status(503).json({ error: 'Servicio no disponible.', code: 'GAME_STATE_UNAVAILABLE' });
  } catch {
    res.status(503).json({ error: 'Servicio no disponible.', code: 'GAME_STATE_UNAVAILABLE' });
  }
});

/**
 * POST /api/game/daily/submit
 * Guarda el resultado del reto del día. Server-authoritative: usa Redis stored answers.
 * El body answers es ignorado para scoring (compatibilidad legacy).
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

    const parsed = z.object({
      dayKey: z.string().optional(),
      clientDate: z.string().optional(),
      answers: z.array(z.object({ questionId: z.string(), answer: z.string() })).max(10).optional(),
    }).safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        code: 'VALIDATION_FAILED',
        params: { fields: mapZodIssuesToFields(parsed.error.errors) },
      });
      return;
    }

    const { dayKey: bodyDayKey, clientDate } = parsed.data;
    const resolvedDayKey = bodyDayKey
      ? bodyDayKey
      : resolveDayKey(clientDate);
    const redis = getRedis();
    const userId = req.user!.userId;
    const playedKey = `daily:played:${userId}:${resolvedDayKey}`;

    // Idempotencia
    try {
      const alreadySaved = await redis.get(playedKey);
      if (alreadySaved) {
        res.json({ message: 'Ya enviado', result: JSON.parse(alreadySaved) });
        return;
      }
    } catch {
      // Redis caído: seguimos con DB guard
    }

    // Get the plan
    const plan = await getOrCreateDailyTour(resolvedDayKey);

    // Consolidar respuestas stored de /daily/answer
    const details: Array<{
      questionId: string;
      countryCode: string;
      category: Category;
      region: DailyTourRegion;
      difficulty: Difficulty | null;
      isCorrect: boolean;
      points: number;
    }> = [];

    for (const stop of plan.stops) {
      const stored = await redis.get(`daily:answer:${userId}:${resolvedDayKey}:${stop.questionId}`);
      let isCorrect = false;
      let points = 0;
      if (stored !== null) {
        const a = JSON.parse(stored) as { isCorrect: boolean; points: number };
        isCorrect = a.isCorrect;
        points = a.points ?? (isCorrect ? DAILY_POINTS_PER_CORRECT : 0);
      }
      // Missing key = unanswered = incorrect
      details.push({
        questionId: stop.questionId,
        countryCode: stop.countryCode,
        category: stop.category,
        region: stop.region,
        difficulty: stop.difficulty,
        isCorrect,
        points,
      });
    }

    const correctCount = details.filter((d) => d.isCorrect).length;
    const score = details.reduce((sum, d) => sum + d.points, 0);
    const totalQuestions = plan.stops.length;

    // User check
    const userRow = await prisma.user.findUnique({
      where: { id: userId },
      select: { highScore: true, dailyStreak: true, lastDailyDate: true },
    });

    // Reenvío del mismo día
    if (userRow?.lastDailyDate === resolvedDayKey) {
      const previous = await getDailyResultFromDb(userId, resolvedDayKey);
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

    const yesterdayKey = addDaysToKey(resolvedDayKey, -1);
    const previousStreak = userRow?.dailyStreak ?? 0;
    const isContinuingStreak = userRow?.lastDailyDate === yesterdayKey;
    const newStreak = isContinuingStreak ? previousStreak + 1 : 1;
    const streakLost = !isContinuingStreak && userRow?.lastDailyDate != null && previousStreak >= 2;

    const runId = `daily:${userId}:${resolvedDayKey}`;

    let concurrentResult: Record<string, unknown> | null = null;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          dailyStreak: newStreak,
          lastDailyDate: resolvedDayKey,
          gamesPlayed: { increment: 1 },
        },
      });

      await tx.gameResult.create({
        data: {
          userId,
          runId,
          score,
          correctCount,
          totalQuestions,
          gameMode: GameMode.SINGLE,
          variant: GameVariant.DAILY,
          category: Category.MIXED,
          details: {
            dailyVersion: DAILY_TOUR_VERSION,
            dayKey: resolvedDayKey,
            stops: details,
          },
        },
      });

      // Always 10 mastery attempts (including timeouts/incorrect)
      const masteryAnswers = details.map((d) => ({
        questionId: d.questionId,
        isCorrect: d.isCorrect,
      }));
      await applyMasteryAttemptsForRun(tx, userId, runId, GameMode.SINGLE, GameVariant.DAILY, masteryAnswers);
    }).catch(async (e: any) => {
      if (e?.code === 'P2002') {
        // Concurrent submit: read existing result
        const existing = await prisma.gameResult.findUnique({
          where: { runId },
        });
        if (existing) {
          const existingDetails = (existing.details as { stops?: typeof details } | null)?.stops;
          concurrentResult = {
            score: existing.score,
            correctCount: existing.correctCount,
            totalQuestions: existing.totalQuestions,
            dailyStreak: userRow?.dailyStreak ?? newStreak,
            playedAt: existing.createdAt.toISOString(),
            details: existingDetails ?? null,
          };
          try {
            await redis.set(playedKey, JSON.stringify(concurrentResult), 'EX', DAILY_TTL_SECONDS);
          } catch { /* best-effort */ }
          return;
        }
      }
      throw e;
    });

    if (concurrentResult) {
      res.json({ message: 'Ya enviado', result: concurrentResult });
      return;
    }

    // If we got here, transaction succeeded
    const result: Record<string, unknown> = {
      score,
      correctCount,
      totalQuestions,
      dailyStreak: newStreak,
      playedAt: new Date().toISOString(),
      details,
    };
    if (streakLost) {
      result.previousStreak = previousStreak;
      result.streakLost = true;
    }

    try {
      await redis.set(playedKey, JSON.stringify(result), 'EX', DAILY_TTL_SECONDS);
    } catch {
      // best-effort: User.lastDailyDate ya quedó persistido
    }

    trackServerEvent({
      name: 'game_finished',
      userId,
      runId,
      gameMode: GameMode.SINGLE,
      variant: GameVariant.DAILY,
      category: Category.MIXED,
      properties: {
        dailyVersion: DAILY_TOUR_VERSION,
        score,
        correctCount,
        totalQuestions,
        dailyStreak: newStreak,
        regionCount: new Set(plan.stops.map((s) => s.region)).size,
        dayKey: resolvedDayKey,
      },
    });

    const newAchievements = await evaluateAchievementsAfterDaily(userId, newStreak).catch(() => []);

    res.json({ result, newAchievements, message: 'Resultado guardado' });
  } catch (error) {
    respondWithError(res, error);
  }
});

export default router;
