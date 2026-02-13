import { Router, Response } from 'express';
import { z } from 'zod';
import { Category, GameMode } from '@prisma/client';
import { authenticateJWT, optionalAuth, AuthRequest } from '../middleware/auth.js';
import {
  getQuestionsForGame,
  validateAnswer,
  saveGameResult,
  getUserGameHistory,
  AnswerResult,
} from '../services/game.service.js';
import { updateLeaderboardScore } from '../services/leaderboard.service.js';
import { config } from '../config/env.js';

const router = Router();

// Schema de validación
const startGameSchema = z.object({
  category: z.nativeEnum(Category).optional().default(Category.MIXED),
  questionCount: z.number().min(5).max(20).optional().default(config.game.questionsPerGame),
});

const answerSchema = z.object({
  questionId: z.string(),
  answer: z.string(),
  timeRemaining: z.number().min(0).max(config.game.timePerQuestion),
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

    const { category, questionCount } = validation.data;

    const questions = await getQuestionsForGame(category, questionCount);

    if (questions.length < questionCount) {
      res.status(503).json({
        error: 'No hay suficientes preguntas disponibles',
        available: questions.length,
        requested: questionCount,
      });
      return;
    }

    res.json({
      message: 'Partida iniciada',
      gameConfig: {
        questionsCount: questions.length,
        timePerQuestion: config.game.timePerQuestion,
        category,
      },
      questions,
    });
  } catch (error) {
    console.error('Error al iniciar partida:', error);
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

    const { questionId, answer, timeRemaining, coordinates } = validation.data;

    const result = await validateAnswer(
      questionId,
      answer,
      timeRemaining,
      coordinates
    );

    res.json({
      ...result,
      timeBonus: result.isCorrect ? Math.floor((timeRemaining / config.game.timePerQuestion) * config.game.maxTimeBonus) : 0,
    });
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

    const { answers, category } = validation.data;

    // Validar todas las respuestas
    const results: AnswerResult[] = [];
    for (const answer of answers) {
      const result = await validateAnswer(
        answer.questionId,
        answer.answer,
        answer.timeRemaining,
        answer.coordinates
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
    const limit = parseInt(req.query.limit as string) || 10;
    const history = await getUserGameHistory(req.user!.userId, Math.min(limit, 50));

    res.json({ history });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
