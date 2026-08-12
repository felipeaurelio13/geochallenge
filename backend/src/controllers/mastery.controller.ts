import { Router, Response } from 'express';
import { z } from 'zod';
import { Category, GameMode, GameVariant } from '@prisma/client';
import { authenticateJWT, AuthRequest } from '../middleware/auth.js';
import {
  getMasterySummary,
  getPassport,
  selectAdaptivePracticeQuestions,
} from '../services/mastery.service.js';
import {
  createGameSession,
  getGameQuestionsByIds,
  toPublicQuestion,
} from '../services/game.service.js';
import { config } from '../config/env.js';
import { respondWithError } from '../utils/respondWithError.js';
import { trackServerEvent } from '../services/telemetry.service.js';

const router = Router();

router.get('/summary', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const summary = await getMasterySummary(req.user!.userId);
    res.json(summary);
  } catch (error) {
    respondWithError(res, error);
  }
});

router.get('/passport', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const countries = await getPassport(req.user!.userId);
    const summary = await getMasterySummary(req.user!.userId);
    res.json({ summary, countries });
  } catch (error) {
    respondWithError(res, error);
  }
});

const practiceStartSchema = z.object({
  count: z.coerce.number().int().min(1).max(20).optional().default(10),
  countryCode: z.string().min(2).max(2).optional(),
});

router.post('/practice/start', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const validation = practiceStartSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Parámetros inválidos', code: 'VALIDATION_FAILED' });
      return;
    }

    const { count, countryCode } = validation.data;
    const userId = req.user!.userId;

    const questionIds = await selectAdaptivePracticeQuestions(
      userId,
      count,
      countryCode ?? undefined
    );

    if (questionIds.length === 0) {
      res.status(409).json({
        error: 'No hay preguntas disponibles para práctica adaptativa',
        code: 'GAME_NOT_ENOUGH_QUESTIONS',
        params: { available: 0, requested: count },
      });
      return;
    }

    const questions = await getGameQuestionsByIds(questionIds);

    if (questions.length < questionIds.length) {
      res.status(409).json({
        error: 'No se pudieron recuperar todas las preguntas seleccionadas. Intenta de nuevo.',
        code: 'GAME_NOT_ENOUGH_QUESTIONS',
        params: { available: questions.length, requested: questionIds.length },
      });
      return;
    }

    const sessionId = await createGameSession({
      userId,
      gameMode: GameMode.SINGLE,
      variant: GameVariant.PRACTICE,
      category: Category.MIXED,
      questions,
    });

    trackServerEvent({
      name: 'game_started',
      userId,
      runId: sessionId,
      gameMode: GameMode.SINGLE,
      variant: GameVariant.PRACTICE,
      category: Category.MIXED,
      properties: {
        questionCount: questions.length,
        countryCode: countryCode ?? null,
      },
    });

    res.json({
      sessionId,
      questions: questions.map(toPublicQuestion),
      gameConfig: {
        questionsCount: questions.length,
        timePerQuestion: config.game.timePerQuestion,
        category: Category.MIXED,
        gameType: 'practice',
        mechanics: { enabled: false, allowed: [], limits: {} },
      },
    });
  } catch (error) {
    respondWithError(res, error);
  }
});

export default router;
