import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { Category, GameMode, Prisma } from '@prisma/client';
import { authenticateJWT, AuthRequest } from '../middleware/auth.js';
import {
  buildFlagMasterRounds,
  scoreFlagMasterAnswer,
  type FlagMasterRound,
  type FlagMasterRoundResult,
} from '../services/flagMaster.service.js';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';
import { getRedis } from '../config/redis.js';
import {
  updateLeaderboardScore,
  updateSeasonLeaderboardScore,
} from '../services/leaderboard.service.js';
import { evaluateAchievementsAfterGame } from '../services/achievement.service.js';

const router = Router();

/**
 * Caché del plan de rondas server-side por gameId.
 *
 * Anti-cheat: el cliente nunca elige multiplicadores ni modifiers; el servidor
 * los recuerda y los aplica en /finish. Si Redis está caído, degradamos a
 * confiar en el cliente (lo registramos en details para auditoría).
 *
 * TTL holgado (45 min) por si el usuario hace pausa: Flag Master dura ~3 min,
 * pero móviles pueden suspender la app o tener cambios de red.
 */
const SESSION_TTL_SECONDS = 60 * 45;

interface CachedSession {
  userId: string;
  startedAt: string;
  rounds: Array<{
    questionId: string;
    correctAnswer: string;
    modifier: FlagMasterRound['flagModifier'];
    multiplier: number;
    tier: number;
  }>;
}

function sessionKey(gameId: string): string {
  return `flagMaster:session:${gameId}`;
}

async function tryCacheSession(gameId: string, payload: CachedSession): Promise<boolean> {
  try {
    const redis = getRedis();
    await redis.set(sessionKey(gameId), JSON.stringify(payload), 'EX', SESSION_TTL_SECONDS);
    return true;
  } catch (err) {
    console.warn('flagMaster: Redis session cache failed (degrading):', err);
    return false;
  }
}

async function loadCachedSession(gameId: string): Promise<CachedSession | null> {
  try {
    const redis = getRedis();
    const raw = await redis.get(sessionKey(gameId));
    if (!raw) return null;
    return JSON.parse(raw) as CachedSession;
  } catch {
    return null;
  }
}

async function deleteCachedSession(gameId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(sessionKey(gameId));
  } catch {
    // best-effort
  }
}

/**
 * POST /api/game/flag-master/start
 * Inicia una sesión de Flag Master: 10 rondas con tiers escalados.
 */
router.post('/start', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const rounds = await buildFlagMasterRounds();
    const gameId = randomUUID();

    const session: CachedSession = {
      userId: req.user!.userId,
      startedAt: new Date().toISOString(),
      rounds: rounds.map((r) => ({
        questionId: r.id,
        correctAnswer: r.correctAnswer,
        modifier: r.flagModifier,
        multiplier: r.multiplier,
        tier: r.tier,
      })),
    };

    await tryCacheSession(gameId, session);

    res.json({
      gameId,
      totalRounds: rounds.length,
      timePerQuestion: config.game.timePerQuestion,
      basePoints: config.game.basePoints,
      maxTimeBonus: config.game.maxTimeBonus,
      rounds: rounds.map((r) => ({
        id: r.id,
        category: r.category,
        questionText: r.questionText,
        options: r.options,
        correctAnswer: r.correctAnswer,
        difficulty: r.difficulty,
        imageUrl: r.imageUrl,
        questionData: r.questionData,
        continent: r.continent,
        flagModifier: r.flagModifier,
        multiplier: r.multiplier,
        tier: r.tier,
        similarityGroupId: r.similarityGroupId,
      })),
    });
  } catch (error: unknown) {
    console.error('Error al iniciar Flag Master:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    // Falta de pool es un caso de negocio, no un 500.
    if (message.startsWith('Flag Master requiere')) {
      res.status(503).json({ error: message });
      return;
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

const finishSchema = z.object({
  gameId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1),
        answer: z.string(),
        timeRemaining: z.number().min(0).max(config.game.timePerQuestion),
      })
    )
    .min(1)
    .max(20),
});

/**
 * POST /api/game/flag-master/finish
 * Valida la sesión y guarda el resultado. Score se recalcula server-side a
 * partir del plan de rondas cacheado (anti-cheat).
 */
router.post('/finish', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = finishSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.errors });
      return;
    }

    const { gameId, answers } = parsed.data;
    const session = await loadCachedSession(gameId);

    if (!session) {
      // Redis caído o sesión expirada. Degradamos: validamos las respuestas
      // contra DB y aplicamos multiplicador 1.0 a todo (no inflar score sin
      // poder verificar qué tier le tocó).
      const fallbackResult = await scoreWithoutSession(answers);
      const persisted = await persistGameResult(
        req.user!.userId,
        fallbackResult,
        { flagMaster: true, degraded: true }
      );
      res.json({
        ...persisted,
        rounds: fallbackResult.rounds,
        degraded: true,
        message: 'Sesión expirada o caché caído: score sin bonificadores.',
      });
      return;
    }

    if (session.userId !== req.user!.userId) {
      res.status(403).json({ error: 'Sesión no pertenece al usuario' });
      return;
    }

    if (answers.length !== session.rounds.length) {
      res.status(400).json({
        error: `Se esperaban ${session.rounds.length} respuestas, llegaron ${answers.length}`,
      });
      return;
    }

    // Validar orden: cada respuesta debe corresponder al questionId de su slot.
    const orderMismatch = answers.findIndex(
      (a, idx) => a.questionId !== session.rounds[idx].questionId
    );
    if (orderMismatch !== -1) {
      res.status(400).json({
        error: `Respuesta ${orderMismatch + 1} no corresponde a la pregunta esperada.`,
      });
      return;
    }

    const rounds: FlagMasterRoundResult[] = answers.map((a, idx) => {
      const slot = session.rounds[idx];
      const isCorrect =
        a.answer.toLowerCase().trim() === slot.correctAnswer.toLowerCase().trim();
      const { basePoints, timeBonus, modifierBonus, points } = scoreFlagMasterAnswer(
        isCorrect,
        a.timeRemaining,
        slot.multiplier,
        config.game.basePoints,
        config.game.maxTimeBonus,
        config.game.timePerQuestion
      );
      return {
        questionId: a.questionId,
        isCorrect,
        correctAnswer: slot.correctAnswer,
        userAnswer: a.answer,
        modifier: slot.modifier,
        multiplier: slot.multiplier,
        basePoints,
        timeBonus,
        modifierBonus,
        points,
        tier: slot.tier,
      };
    });

    const totalScore = rounds.reduce((s, r) => s + r.points, 0);
    const correctCount = rounds.filter((r) => r.isCorrect).length;

    const persisted = await persistGameResult(
      req.user!.userId,
      { totalScore, correctCount, totalQuestions: rounds.length, rounds },
      { flagMaster: true }
    );

    await deleteCachedSession(gameId);

    res.json({
      ...persisted,
      rounds,
    });
  } catch (error) {
    console.error('Error al finalizar Flag Master:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/game/flag-master/availability
 * Útil para mostrar/ocultar el card de Flag Master en el menú.
 */
router.get('/availability', authenticateJWT, async (_req: AuthRequest, res: Response) => {
  try {
    const hardCount = await prisma.question.count({
      where: { category: Category.FLAG, isAvailable: true, difficulty: 'HARD' },
    });
    const mediumCount = await prisma.question.count({
      where: { category: Category.FLAG, isAvailable: true, difficulty: 'MEDIUM' },
    });
    const total = hardCount + mediumCount;
    res.json({
      canPlay: total >= 10,
      hardAvailable: hardCount,
      mediumAvailable: mediumCount,
      required: 10,
    });
  } catch (error) {
    console.error('Error al consultar disponibilidad Flag Master:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function scoreWithoutSession(
  answers: { questionId: string; answer: string; timeRemaining: number }[]
): Promise<{
  totalScore: number;
  correctCount: number;
  totalQuestions: number;
  rounds: FlagMasterRoundResult[];
}> {
  const questions = await prisma.question.findMany({
    where: { id: { in: answers.map((a) => a.questionId) }, category: Category.FLAG },
  });
  const byId = new Map(questions.map((q) => [q.id, q]));

  const rounds: FlagMasterRoundResult[] = answers.map((a, idx) => {
    const q = byId.get(a.questionId);
    const correctAnswer = q?.correctAnswer ?? '';
    const isCorrect =
      !!q &&
      a.answer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    const { basePoints, timeBonus, modifierBonus, points } = scoreFlagMasterAnswer(
      isCorrect,
      a.timeRemaining,
      1.0,
      config.game.basePoints,
      config.game.maxTimeBonus,
      config.game.timePerQuestion
    );
    return {
      questionId: a.questionId,
      isCorrect,
      correctAnswer,
      userAnswer: a.answer,
      modifier: 'none',
      multiplier: 1.0,
      basePoints,
      timeBonus,
      modifierBonus,
      points,
      tier: idx < 2 ? 1 : idx < 4 ? 2 : idx < 6 ? 3 : idx < 8 ? 4 : 5,
    };
  });

  const totalScore = rounds.reduce((s, r) => s + r.points, 0);
  const correctCount = rounds.filter((r) => r.isCorrect).length;

  return {
    totalScore,
    correctCount,
    totalQuestions: rounds.length,
    rounds,
  };
}

async function persistGameResult(
  userId: string,
  payload: {
    totalScore: number;
    correctCount: number;
    totalQuestions: number;
    rounds: FlagMasterRoundResult[];
  },
  extraDetails: Record<string, unknown>
): Promise<{
  gameId: string;
  totalScore: number;
  correctCount: number;
  totalQuestions: number;
  accuracy: number;
  isHighScore: boolean;
  newAchievements: string[];
}> {
  const details = {
    ...extraDetails,
    rounds: payload.rounds,
  };

  const result = await prisma.$transaction(async (db) => {
    const gameResult = await db.gameResult.create({
      data: {
        userId,
        score: payload.totalScore,
        correctCount: payload.correctCount,
        totalQuestions: payload.totalQuestions,
        category: Category.FLAG,
        gameMode: GameMode.SINGLE,
        details: details as unknown as Prisma.InputJsonValue,
      },
    });

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { highScore: true },
    });
    const isHighScore = payload.totalScore > (user?.highScore ?? 0);

    await db.user.update({
      where: { id: userId },
      data: {
        gamesPlayed: { increment: 1 },
        ...(isHighScore && { highScore: payload.totalScore }),
      },
    });

    return { gameId: gameResult.id, isHighScore };
  });

  await Promise.all([
    updateLeaderboardScore(userId, payload.totalScore),
    updateSeasonLeaderboardScore(userId, payload.totalScore),
  ]).catch(() => {});

  const newAchievements = await evaluateAchievementsAfterGame({
    userId,
    correctCount: payload.correctCount,
    totalQuestions: payload.totalQuestions,
    score: payload.totalScore,
  }).catch(() => []);

  const accuracy = Math.round((payload.correctCount / payload.totalQuestions) * 100);

  return {
    gameId: result.gameId,
    totalScore: payload.totalScore,
    correctCount: payload.correctCount,
    totalQuestions: payload.totalQuestions,
    accuracy,
    isHighScore: result.isHighScore,
    newAchievements,
  };
}

export default router;
