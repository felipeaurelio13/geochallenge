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

const router = Router();

const BOSS_START_EXPIRY_MINUTES = 30;

interface PersistedAnswer {
  id: string;
  attemptId: string;
  questionId: string;
  questionIndex: number;
  userAnswer: string;
  isCorrect: boolean;
  points: number;
  answeredAt: Date;
}

interface AttemptState {
  id: string;
  currentQuestionIndex: number;
  correctCount: number;
  score: number;
  status: WorldEventBossAttemptStatus;
}

/**
 * Build the canonical answer response for an already-persisted answer
 * (sequential retry or concurrent P2002 winner). Derived from persisted state
 * so retries never double-count and always return the same shape.
 */
function buildCanonicalAnswerResponse(
  existingAnswer: Pick<PersistedAnswer, 'questionId' | 'questionIndex' | 'isCorrect' | 'points'>,
  attempt: AttemptState,
  correctAnswer: string,
) {
  const isFinal = existingAnswer.questionIndex >= BOSS_TOTAL_QUESTIONS - 1;
  return {
    questionId: existingAnswer.questionId,
    isCorrect: existingAnswer.isCorrect,
    points: existingAnswer.points,
    correctAnswer,
    questionIndex: existingAnswer.questionIndex,
    nextQuestionIndex: attempt.currentQuestionIndex,
    correctCount: attempt.correctCount,
    score: attempt.score,
    totalQuestions: BOSS_TOTAL_QUESTIONS,
    isFinal,
    ...(isFinal ? { cleared: attempt.correctCount >= BOSS_HP_REQUIRED } : {}),
  };
}

/**
 * Idempotent achievement evaluation for a finished boss run. Errors are
 * swallowed so a transient failure on the first finish can recover on retry
 * without breaking the response.
 */
async function runBossAchievements(
  userId: string,
  correctCount: number,
  totalQuestions: number,
  score: number,
): Promise<void> {
  await evaluateAchievementsAfterBoss(userId, correctCount).catch(() => []);
  await evaluateAchievementsAfterGame({ userId, correctCount, totalQuestions, score }).catch(() => []);
}

/**
 * GET /api/events/current
 * Side-effect free. Returns event info, progress, boss status.
 */
router.get('/current', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const event = getCurrentWorldEvent();

    // Do NOT create the plan here — progress is derived from eventId alone.
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
 * Start or resume a boss attempt. Concurrent starts are serialized with a
 * Postgres advisory lock so a user can never end up with two ACTIVE attempts.
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

    // Get or create plan (P2002 race handled)
    const plan = await getOrCreateWorldEventPlan(event.eventId);

    // Find-or-create ACTIVE attempt, serialized per user+event.
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`boss:start:${userId}:${event.eventId}`}))`;

      const existingAttempt = await tx.worldEventBossAttempt.findFirst({
        where: {
          userId,
          eventId: event.eventId,
          status: WorldEventBossAttemptStatus.ACTIVE,
        },
      });

      if (existingAttempt) {
        if (existingAttempt.expiresAt > new Date()) {
          // Authoritative clock handoff: after a non-final answer the server
          // cleared questionStartedAt, so the next serve (this start) owns the
          // clock. A real resume (questionStartedAt set) must NOT reset it.
          if (existingAttempt.questionStartedAt === null) {
            const clocked = await tx.worldEventBossAttempt.update({
              where: { id: existingAttempt.id },
              data: { questionStartedAt: new Date() },
            });
            return { attempt: clocked, resumed: true };
          }
          return { attempt: existingAttempt, resumed: true };
        }
        await tx.worldEventBossAttempt.update({
          where: { id: existingAttempt.id },
          data: { status: WorldEventBossAttemptStatus.ABANDONED },
        });
      }

      const expiresAt = new Date(Date.now() + BOSS_START_EXPIRY_MINUTES * 60 * 1000);
      const created = await tx.worldEventBossAttempt.create({
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

      return { attempt: created, resumed: false };
    });

    const { attempt, resumed } = result;

    // Get question data
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

    // game_started is server-owned and only represents a NEW run, never a
    // resume. The eventKey already deduplicates resumes, but avoiding the
    // P2002 write entirely keeps telemetry free of noise.
    if (!resumed) {
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
    }

    // Authoritative remaining time for the question being served. The frontend
    // starts its Timer from this value (never a full reset on resume).
    const serverNow = Date.now();
    const questionClockStart = attempt.questionStartedAt ?? attempt.startedAt;
    const timeRemainingMs = Math.max(0, BOSS_QUESTION_SECONDS * 1000 - (serverNow - questionClockStart.getTime()));

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
      timeRemainingMs,
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
 *
 * Idempotency contract:
 *  - Sequential retry of any already-answered question returns the canonical
 *    response derived from the persisted answer + attempt (no re-scoring).
 *  - Concurrent duplicate submissions are first-write-wins: the losing
 *    transaction hits P2002 and returns the winner's canonical response.
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

    // Load plan
    const plan = await getOrCreateWorldEventPlan(attempt.eventId);

    // Resolve whether this question was ALREADY answered — BEFORE rejecting on
    // status/expected-question so retries of question N (after index advanced)
    // and retries of the final question (after COMPLETED) still work.
    const existingAnswer = await prisma.worldEventBossAnswer.findFirst({
      where: { attemptId, questionId },
    });

    if (existingAnswer) {
      const retryIsFinal = existingAnswer.questionIndex >= BOSS_TOTAL_QUESTIONS - 1;

      // Achievement recovery: if the first finish had a transient achievement
      // failure, the retry re-runs them (idempotent, no duplicates).
      if (retryIsFinal) {
        await runBossAchievements(userId, attempt.correctCount, BOSS_TOTAL_QUESTIONS, attempt.score);
      }

      const correctAnswer = await fetchCorrectAnswer(existingAnswer.questionId);
      res.json(buildCanonicalAnswerResponse(existingAnswer, attempt, correctAnswer));
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

    // First-write-wins transaction. A concurrent duplicate hits the unique
    // constraint and is resolved outside the transaction.
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
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
            // Clear the clock after a non-final answer: the next start/serve
            // owns a fresh authoritative questionStartedAt when it hands the
            // next question to the client (feedback is not part of the clock).
            questionStartedAt: null,
            ...(isFinal ? {
              status: WorldEventBossAttemptStatus.COMPLETED,
              finishedAt: new Date(),
            } : {}),
          },
        });

        // On final answer: create GameResult + increment gamesPlayed (atomic)
        if (isFinal) {
          const runId = `event-boss:${attemptId}`;

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
    } catch (e: any) {
      if (e?.code === 'P2002') {
        // First-write-wins: another concurrent request already persisted this
        // answer. Return the winner's canonical state — never a 500.
        const winnerAnswer = await prisma.worldEventBossAnswer.findFirst({
          where: { attemptId, questionId },
        });
        const winnerAttempt = await prisma.worldEventBossAttempt.findUnique({
          where: { id: attemptId },
        });

        if (winnerAnswer && winnerAttempt) {
          const winnerIsFinal = winnerAnswer.questionIndex >= BOSS_TOTAL_QUESTIONS - 1;
          if (winnerIsFinal) {
            await runBossAchievements(userId, winnerAttempt.correctCount, BOSS_TOTAL_QUESTIONS, winnerAttempt.score);
          }
          res.json(buildCanonicalAnswerResponse(winnerAnswer, winnerAttempt, question.correctAnswer));
          return;
        }
      }
      throw e;
    }

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

      await runBossAchievements(userId, result.newCorrectCount, BOSS_TOTAL_QUESTIONS, result.newScore);
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

async function fetchCorrectAnswer(questionId: string): Promise<string> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: { correctAnswer: true },
  });
  return question?.correctAnswer ?? '';
}

export default router;