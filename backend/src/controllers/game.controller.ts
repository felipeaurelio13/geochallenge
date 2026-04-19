import { Router, Response } from 'express';
import { z } from 'zod';
import { Category, GameMode } from '@prisma/client';
import { authenticateJWT, optionalAuth, AuthRequest } from '../middleware/auth.js';
import {
  getQuestionsForGame,
  getQuestionsForStreakGame,
  getStreakBatchSize,
  getQuestionsForFlashGame,
  getFlashDurationSeconds,
  validateAnswerByGameType,
  saveGameResult,
  getUserGameHistory,
  AnswerResult,
} from '../services/game.service.js';
import { updateLeaderboardScore } from '../services/leaderboard.service.js';
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

// Schema de validación
export const startGameSchema = z.object({
  category: z.nativeEnum(Category).optional().default(Category.MIXED),
  questionCount: z.coerce.number().min(5).max(20).optional().default(config.game.questionsPerGame),
  gameType: gameTypeSchema.optional().default('single'),
  excludeIds: excludeIdsSchema.optional().default([]),
  excludeQuestionKeys: excludeIdsSchema.optional().default([]),
});

const answerSchema = z.object({
  questionId: z.string(),
  answer: z.string(),
  timeRemaining: z.number().min(0).max(config.game.timePerQuestion),
  gameType: gameTypeSchema.optional().default('single'),
  combo: z.number().int().min(0).max(200).optional(),
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

    const { category, questionCount, gameType, excludeIds, excludeQuestionKeys } = validation.data;
    const expectedQuestions = gameType === 'streak'
      ? getStreakBatchSize(questionCount)
      : questionCount;

    const questions = gameType === 'streak'
      ? await getQuestionsForStreakGame(category, excludeIds, questionCount, excludeQuestionKeys)
      : await getQuestionsForGame(category, questionCount);

    if (questions.length < expectedQuestions) {
      res.status(503).json({
        error: 'No hay suficientes preguntas disponibles',
        available: questions.length,
        requested: expectedQuestions,
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
      },
      questions,
    });
  } catch (error) {
    console.error('Error al iniciar partida:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/game/flash/start
 * Inicia una sesión Flash: 60 preguntas visuales (FLAG + SILHOUETTE), 2 opciones.
 */
router.get('/flash/start', optionalAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const questions = await getQuestionsForFlashGame();
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
      res.status(400).json({
        error: 'Datos inválidos',
        details: validation.error.errors,
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

    // Actualizar leaderboard si es highscore
    if (isHighScore) {
      await updateLeaderboardScore(req.user!.userId, totalScore);
    }

    // Calcular estadísticas
    const correctCount = results.filter((r) => r.isCorrect).length;
    const accuracy = Math.round((correctCount / results.length) * 100);

    res.json({
      message: 'Partida finalizada',
      gameId,
      totalScore,
      correctCount,
      totalQuestions: results.length,
      accuracy,
      isHighScore,
      details: results,
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

export default router;
