import { Router, Response } from 'express';
import { z } from 'zod';
import { Category, GameMode, GameVariant, WorldEventBossAttemptStatus } from '@prisma/client';
import { authenticateJWT, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../config/database.js';
import { respondWithError } from '../utils/respondWithError.js';
import { trackServerEvent } from '../services/telemetry.service.js';
import { evaluateAchievementsAfterBoss, evaluateAchievementsAfterGame } from '../services/achievement.service.js';
import {
  getCurrentWorldEvent,
  getWorldEventProgress,
  getOrCreateWorldEventPlan,
  toPublicBossQuestion,
  BOSS_QUESTION_SECONDS,
  BOSS_SERVER_GRACE_MS,
  BOSS_TOTAL_QUESTIONS,
  BOSS_HP_REQUIRED,
  WORLD_EVENT_VERSION,
  WORLD_EVENT_BOSS_VERSION,
  type WorldEventPlanData,
} from '../services/worldEvent.service.js';
import { prisma as db } from '../config/database.js';

const router = Router();

const BOSS_START_EXPIRY_MINUTES = 30;

/**
 * GET /api/events/current
 * Side-effect free. Returns event info, progress, boss status.
 */
router.get('/current', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const event = getCurrentWorldEvent();

    // Get or check if plan exists (don't create)
    const plan = await prisma.worldEventPlan.findUnique({
      where: { eventId: event.eventId },
    });

    // Compute progress
    const progress = await getWorldEventProgress(userId, event.eventId, event.region);

    // Boss status
    const completedAttempts = await prisma.worldEventBossAttempt.findMany({
      where: {
        userId,
        eventId: event.eventId,
        status: WorldEventBossAttemptStatus.COMPLETED,
      },
      select: {
        correctCount: true,
        score: true,
      },
    });

    const attempts = completedAttempts.length;
    const bestCorrect = attempts > 0 ? Math.max(...completedAttempts.map((a) => a.correctCount)) : 0;
    const bestScore = attempts > 0 ? Math.max(...completedAttempts.map((a) => a.score)) : 0;
    const cleared = bestCorrect >= BOSS_HP_REQUIRED;

    // Active attempt
    const activeAttempt = await prisma.worldEventBossAttempt.findFirst({
      where: {
        userId,
        eventId: event.eventId,
        status: WorldEventBossAttemptStatus.ACTIVE,
      },
      select: {
        id: true,
        currentQuestionIndex: true,
        expiresAt: true,
      },
    });

    res.json({
      event: {
        eventId: event.eventId,
        version: WORLD_EVENT_VERSION,
        region: event.region,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
      },
      progress: {
        correctInRegion: progress.correctInRegion,
        correctRequired: progress.correctRequired,
        distinctCategories: progress.distinctCategories,
        categoriesRequired: progress.categoriesRequired,
        dailyCompleted: progress.dailyCompleted,
        bossUnlocked: progress.bossUnlocked,
      },
      boss: {
        unlocked: progress.bossUnlocked,
        cleared,
        attempts,
        bestCorrect,
        bestScore,
        activeAttempt: activeAttempt ?? null,
      },
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    respondWithError(res, error);
  }
});

/**
 * POST /api/events/current/boss/start
 * Start or resume a boss attempt.
 */
router.post('/current/boss/start', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const event = getCurrentWorldEvent();

    // Recompute progress server-side (never trust client)
    const progress = await getWorldEventProgress(userId, event.eventId, event.region);

    if (!progress.bossUnlocked) {
      res.status(403).json({
        error: 'Boss no desbloqueado',
        code: 'EVENT_BOSS_LOCKED',
        progress: {
          correctInRegion: progress.correctInRegion,
          correctRequired: progress.correctRequired,
          distinctCategories: progress.distinctCategories,
          categoriesRequired: progress.categoriesRequired,
          dailyCompleted: progress.dailyCompleted,
        },
      });
      return;
    }

    // Get or create plan
    const plan = await getOrCreateWorldEventPlan(event.eventId);

    // Check for existing active attempt
    const existingAttempt = await prisma.worldEventBossAttempt.findFirst({
      where: {
        userId,
        eventId: event.eventId,
        status: WorldEventBossAttemptStatus.ACTIVE,
      },
    });

    let attempt;
    let resumed = false;

    if (existingAttempt) {
      if (existingAttempt.expiresAt > new Date()) {
        // Resume existing attempt
        attempt = existingAttempt;
        resumed = true;
      } else {
        // Expire old attempt
        await prisma.worldEventBossAttempt.update({
          where: { id: existingAttempt.id },
          data: { status: WorldEventBossAttemptStatus.ABANDONED },
        });
      }
    }

    if (!attempt) {
      // Create new attempt
      const expiresAt = new Date(Date.now() + BOSS_START_EXPIRY_MINUTES * 60 * 1000);
      attempt = await prisma.worldEventBossAttempt.create({
        data: {
          eventId: event.eventId,
          userId,
          status: WorldEventBossAttemptStatus.ACTIVE,
          currentQuestionIndex: 0,
          correctCount: 0,
          score: 0,
          questionStartedAt: new Date(),
          expiresAt,
        },
      });
    }

    // Get first question data
    const questionIndex = attempt.currentQuestionIndex;
    const questionId = plan.questionIds[questionIndex];
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        category: true,
        questionData: true,
        options: true,
        imageUrl: true,
        difficulty: true,
      },
    });

    if (!question) {
      res.status(500).json({ error: 'Pregunta no encontrada', code: 'BOSS_QUESTION_NOT_FOUND' });
      return;
    }

    const publicQuestion = toPublicBossQuestion(plan, questionIndex, question);

    trackServerEvent({
      name: 'game_started',
      userId,
      runId: `event-boss:${attempt.id}`,
      gameMode: GameMode.SINGLE,
      variant: GameVariant.EVENT_BOSS,
      category: Category.MIXED,
      properties: {
        eventId: event.eventId,
        eventVersion: WORLD_EVENT_VERSION,
        bossVersion: WORLD_EVENT_BOSS_VERSION,
        region: event.region,
      },
    });

    res.json({
      resumed,
      attemptId: attempt.id,
      eventId: event.eventId,
      region: event.region,
      questionIndex,
      totalQuestions: BOSS_TOTAL_QUESTIONS,
      correctCount: attempt.correctCount,
      score: attempt.score,
      expiresAt: attempt.expiresAt.toISOString(),
      question: publicQuestion,
      timeLimit: BOSS_QUESTION_SECONDS,
      boss: {
        hitsRequired: BOSS_HP_REQUIRED,
        hits: attempt.correctCount,
      },
    });
  } catch (error) {
    respondWithError(res, error);
  }
});

/**
 * POST /api/events/boss/:attemptId/answer
 * Submit an answer to a boss question.
 */
router.post('/boss/:attemptId/answer', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { attemptId } = req.params;
    const userId = req.user!.userId;

    const answerSchema = z.object({
      questionId: z.string().min(1),
      answer: z.string(),
    });

    const parsed = answerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', code: 'VALIDATION_FAILED' });
      return;
    }

    const { questionId, answer } = parsed.data;

    // Load attempt
    const attempt = await prisma.worldEventBossAttempt.findUnique({
      where: { id: attemptId },
    });

    if (!attempt) {
      res.status(404).json({ error: 'Attempt no encontrado', code: 'BOSS_ATTEMPT_NOT_FOUND' });
      return;
    }

    // Owner check
    if (attempt.userId !== userId) {
      res.status(403).json({ error: 'No autorizado', code: 'BOSS_UNAUTHORIZED' });
      return;
    }

    // Status check
    if (attempt.status !== WorldEventBossAttemptStatus.ACTIVE) {
      res.status(400).json({ error: 'Attempt no activo', code: 'BOSS_ATTEMPT_NOT_ACTIVE' });
      return;
    }

    // Expiry check
    if (attempt.expiresAt <= new Date()) {
      await prisma.worldEventBossAttempt.update({
        where: { id: attemptId },
        data: { status: WorldEventBossAttemptStatus.ABANDONED },
      });
      res.status(410).json({ error: 'Attempt expirado', code: 'BOSS_ATTEMPT_EXPIRED' });
      return;
    }

    // Load plan
    const plan = await getOrCreateWorldEventPlan(attempt.eventId);

    // Validate question is expected
    const expectedQuestionId = plan.questionIds[attempt.currentQuestionIndex];
    if (questionId !== expectedQuestionId) {
      res.status(400).json({ error: 'Pregunta inesperada', code: 'BOSS_UNEXPECTED_QUESTION' });
      return;
    }

    // Server-time check
    const questionStartedAt = attempt.questionStartedAt ?? attempt.startedAt;
    const elapsedMs = Date.now() - questionStartedAt.getTime();
    const deadlineMs = BOSS_QUESTION_SECONDS * 1000 + BOSS_SERVER_GRACE_MS;
    const timedOut = elapsedMs > deadlineMs;

    // Validate answer server-side
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: { correctAnswer: true },
    });

    if (!question) {
      res.status(500).json({ error: 'Pregunta no encontrada', code: 'BOSS_QUESTION_NOT_FOUND' });
      return;
    }

    const isCorrect = !timedOut && answer.trim().toLowerCase() === question.correctAnswer.toLowerCase().trim();
    const points = isCorrect ? 100 : 0;

    // Check for duplicate answer (first-write-wins)
    const existingAnswer = await prisma.worldEventBossAnswer.findUnique({
      where: {
        attemptId_questionIndex: {
          attemptId,
          questionIndex: attempt.currentQuestionIndex,
        },
      },
    });

    if (existingAnswer) {
      // Return existing result (idempotent)
      res.json({
        questionId,
        isCorrect: existingAnswer.isCorrect,
        points: existingAnswer.points,
        correctAnswer: question.correctAnswer,
        questionIndex: attempt.currentQuestionIndex,
        nextQuestionIndex: attempt.currentQuestionIndex + 1,
        correctCount: attempt.correctCount,
        score: attempt.score,
        totalQuestions: BOSS_TOTAL_QUESTIONS,
        isFinal: attempt.currentQuestionIndex + 1 >= BOSS_TOTAL_QUESTIONS,
      });
      return;
    }

    // Create answer + update attempt in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create answer
      const createdAnswer = await tx.worldEventBossAnswer.create({
        data: {
          attemptId,
          questionId,
          questionIndex: attempt.currentQuestionIndex,
          userAnswer: timedOut ? '' : answer,
          isCorrect,
          points,
        },
      });

      // Update attempt
      const newCorrectCount = attempt.correctCount + (isCorrect ? 1 : 0);
      const newScore = attempt.score + points;
      const nextIndex = attempt.currentQuestionIndex + 1;
      const isFinal = nextIndex >= BOSS_TOTAL_QUESTIONS;

      const updatedAttempt = await tx.worldEventBossAttempt.update({
        where: { id: attemptId },
        data: {
          correctCount: newCorrectCount,
          score: newScore,
          currentQuestionIndex: nextIndex,
          questionStartedAt: new Date(),
          ...(isFinal ? {
            status: WorldEventBossAttemptStatus.COMPLETED,
            finishedAt: new Date(),
          } : {}),
        },
      });

      // On final answer: create GameResult + increment gamesPlayed
      if (isFinal) {
        const runId = `event-boss:${attemptId}`;

        // Check for existing GameResult (idempotency)
        const existingGame = await tx.gameResult.findUnique({ where: { runId } });
        if (!existingGame) {
          await tx.gameResult.create({
            data: {
              userId,
              runId,
              score: newScore,
              correctCount: newCorrectCount,
              totalQuestions: BOSS_TOTAL_QUESTIONS,
              gameMode: GameMode.SINGLE,
              variant: GameVariant.EVENT_BOSS,
              category: Category.MIXED,
              details: {
                eventId: attempt.eventId,
                eventVersion: WORLD_EVENT_VERSION,
                bossVersion: WORLD_EVENT_BOSS_VERSION,
                region: plan.region,
                cleared: newCorrectCount >= BOSS_HP_REQUIRED,
                attemptId,
              },
            },
          });

          // Increment gamesPlayed once
          await tx.user.update({
            where: { id: userId },
            data: { gamesPlayed: { increment: 1 } },
          });
        }
      }

      return {
        answer: createdAnswer,
        attempt: updatedAttempt,
        isFinal,
        newCorrectCount,
        newScore,
      };
    });

    trackServerEvent({
      name: 'question_answered',
      userId,
      runId: `event-boss:${attemptId}`,
      questionId,
      gameMode: GameMode.SINGLE,
      variant: GameVariant.EVENT_BOSS,
      category: Category.MIXED,
      properties: {
        eventId: attempt.eventId,
        region: plan.region,
        roundIndex: attempt.currentQuestionIndex,
        isCorrect,
        points,
        timedOut,
      },
    });

    // On finish: evaluate achievements
    if (result.isFinal) {
      trackServerEvent({
        name: 'game_finished',
        userId,
        runId: `event-boss:${attemptId}`,
        gameMode: GameMode.SINGLE,
        variant: GameVariant.EVENT_BOSS,
        category: Category.MIXED,
        properties: {
          eventId: attempt.eventId,
          region: plan.region,
          score: result.newScore,
          correctCount: result.newCorrectCount,
          cleared: result.newCorrectCount >= BOSS_HP_REQUIRED,
        },
      });

      // Evaluate boss-specific achievements
      await evaluateAchievementsAfterBoss(userId, result.newCorrectCount).catch(() => []);

      // Also evaluate general achievements (FIRST_GAME, PERFECT_GAME, HIGH_SCORE_1K)
      await evaluateAchievementsAfterGame({
        userId,
        correctCount: result.newCorrectCount,
        totalQuestions: BOSS_TOTAL_QUESTIONS,
        score: result.newScore,
      }).catch(() => []);
    }

    res.json({
      questionId,
      isCorrect,
      points,
      correctAnswer: question.correctAnswer,
      questionIndex: attempt.currentQuestionIndex,
      nextQuestionIndex: result.attempt.currentQuestionIndex,
      correctCount: result.newCorrectCount,
      score: result.newScore,
      totalQuestions: BOSS_TOTAL_QUESTIONS,
      isFinal: result.isFinal,
      ...(result.isFinal ? {
        cleared: result.newCorrectCount >= BOSS_HP_REQUIRED,
      } : {}),
    });
  } catch (error) {
    respondWithError(res, error);
  }
});

export default router;
