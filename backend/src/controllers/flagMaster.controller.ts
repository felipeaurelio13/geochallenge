import { Router, Response } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { Category, GameMode, GameVariant, Prisma } from '@prisma/client';
import { authenticateJWT, AuthRequest } from '../middleware/auth.js';
import {
  buildFlagMasterRounds,
  getTierConfigForRound,
  scoreFlagMasterAnswer,
  type FlagMasterRound,
  type FlagMasterRoundResult,
} from '../services/flagMaster.service.js';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';
import { getRedis } from '../config/redis.js';
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

const answerSchema = z.object({
  gameId: z.string().min(1),
  questionId: z.string().min(1),
  answer: z.string(),
  timeRemaining: z.number().min(0).max(config.game.timePerQuestion),
});

/**
 * POST /api/game/flag-master/answer
 * Server-authoritative: la respuesta se valida y almacena server-side.
 * Primera respuesta inmutable, re-answer devuelve stored result.
 */
router.post('/answer', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = answerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos' });
      return;
    }
    const { gameId, questionId, answer, timeRemaining } = parsed.data;
    const session = await loadCachedSession(gameId);
    if (!session) {
      res.status(503).json({ error: 'Servicio no disponible. Intenta de nuevo.', code: 'GAME_STATE_UNAVAILABLE' });
      return;
    }
    if (session.userId !== req.user!.userId) {
      res.status(403).json({ error: 'Sesión no pertenece al usuario' });
      return;
    }
    const roundData = session.rounds.find((r) => r.questionId === questionId);
    if (!roundData) {
      res.status(400).json({ error: 'Pregunta no pertenece a esta partida' });
      return;
    }

    // Atomic first answer: SET NX, fail-closed
    const answerKey = `flagMaster:answer:${gameId}:${questionId}`;
    const redis = getRedis();

    const isCorrect = answer.trim().toLowerCase() === roundData.correctAnswer.toLowerCase().trim();
    const scoring = scoreFlagMasterAnswer(isCorrect, timeRemaining, roundData.multiplier, config.game.basePoints, config.game.maxTimeBonus, config.game.timePerQuestion);

    const candidate = {
      questionId,
      isCorrect,
      correctAnswer: roundData.correctAnswer,
      points: scoring.points,
      basePoints: scoring.basePoints,
      timeBonus: scoring.timeBonus,
      modifierBonus: scoring.modifierBonus,
      multiplier: roundData.multiplier,
      tier: roundData.tier,
    };

    const nxResult = await redis.set(answerKey, JSON.stringify(candidate), 'EX', 3600, 'NX');
    if (nxResult === 'OK') { res.json(candidate); return; }

    const winner = await redis.get(answerKey);
    if (winner) { res.json(JSON.parse(winner) as Record<string, unknown>); return; }

    res.json(candidate);
  } catch {
    res.status(503).json({ error: 'Servicio no disponible. Intenta de nuevo.', code: 'GAME_STATE_UNAVAILABLE' });
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
      res.status(503).json({ error: 'Servicio no disponible.', code: 'GAME_STATE_UNAVAILABLE' });
      return;
    }

    if (session.userId !== req.user!.userId) {
      res.status(403).json({ error: 'Sesión no pertenece al usuario' });
      return;
    }

    // Consolidar stored answers server-side (no confiar en body del cliente)
    const rounds: FlagMasterRoundResult[] = [];
    let totalScore = 0;
    let correctCount = 0;
    const redis = getRedis();

    for (const slot of session.rounds) {
      const answerKey = `flagMaster:answer:${gameId}:${slot.questionId}`;
      const stored = await redis.get(answerKey);
      if (stored) {
        const a = JSON.parse(stored) as { isCorrect: boolean; points: number; correctAnswer: string; multiplier: number; basePoints?: number; timeBonus?: number; modifierBonus?: number };
        rounds.push({
          questionId: slot.questionId,
          isCorrect: a.isCorrect,
          correctAnswer: a.correctAnswer,
          userAnswer: '',
          modifier: slot.modifier,
          multiplier: slot.multiplier,
          basePoints: a.basePoints ?? 0,
          timeBonus: a.timeBonus ?? 0,
          modifierBonus: a.modifierBonus ?? 0,
          points: a.points,
          tier: slot.tier,
        });
        totalScore += a.points;
        if (a.isCorrect) correctCount++;
      } else {
        rounds.push({
          questionId: slot.questionId, isCorrect: false, correctAnswer: slot.correctAnswer,
          userAnswer: '', modifier: slot.modifier, multiplier: slot.multiplier,
          basePoints: 0, timeBonus: 0, modifierBonus: 0, points: 0, tier: slot.tier,
        });
      }
    }

    // Persistir en transacción: GameResult + gamesPlayed juntos.
    // Solo el request que crea el registro incrementa gamesPlayed.
    const { prisma: db } = await import('../config/database.js');
    let persistedGameId: string;
    let created = false;

    try {
      const result = await db.$transaction(async (tx) => {
        // Verificar si ya existe (finish concurrente)
        const existing = await tx.gameResult.findUnique({ where: { runId: gameId as string } });
        if (existing) return { id: existing.id, created: false };

        const created = await tx.gameResult.create({
          data: {
            userId: req.user!.userId,
            score: totalScore,
            correctCount,
            totalQuestions: session.rounds.length,
            category: 'FLAG',
            gameMode: 'SINGLE',
            variant: 'FLAG_MASTER',
            runId: gameId as string,
            details: { flagMaster: true, rounds: rounds as unknown as Prisma.InputJsonValue },
          },
        });

        await tx.user.update({
          where: { id: req.user!.userId },
          data: { gamesPlayed: { increment: 1 } },
        });

        return { id: created.id, created: true };
      });

      persistedGameId = result.id;
      created = result.created;
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        const existing = await db.gameResult.findUnique({ where: { runId: gameId } });
        if (existing) { persistedGameId = existing.id; created = false; }
        else throw err;
      } else throw err;
    }

    await deleteCachedSession(gameId);

    const newAchievements = created
      ? await evaluateAchievementsAfterGame({
          userId: req.user!.userId, correctCount, totalQuestions: session.rounds.length, score: totalScore,
        }).catch(() => [])
      : [];

    res.json({
      gameId: persistedGameId,
      totalScore,
      correctCount,
      totalQuestions: session.rounds.length,
      accuracy: Math.round((correctCount / session.rounds.length) * 100),
      isHighScore: false,
      newAchievements,
      rounds,
    });
  } catch (error) {
    console.error('Error al finalizar Flag Master:', error);
    res.status(503).json({ error: 'Servicio no disponible.', code: 'GAME_STATE_UNAVAILABLE' });
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
    // El tier plan es determinístico por índice de ronda: aún sin Redis podemos
    // aplicar el multiplicador correcto. Lo único que perdemos sin Redis es la
    // validación de que las preguntas servidas fueron las que el server emitió;
    // el cliente podría reordenar para meter preguntas conocidas en tiers altos,
    // pero ese vector queda registrado en details.degraded para auditoría.
    const tierConfig = getTierConfigForRound(idx);
    const { basePoints, timeBonus, modifierBonus, points } = scoreFlagMasterAnswer(
      isCorrect,
      a.timeRemaining,
      tierConfig.multiplier,
      config.game.basePoints,
      config.game.maxTimeBonus,
      config.game.timePerQuestion
    );
    return {
      questionId: a.questionId,
      isCorrect,
      correctAnswer,
      userAnswer: a.answer,
      modifier: tierConfig.modifier,
      multiplier: tierConfig.multiplier,
      basePoints,
      timeBonus,
      modifierBonus,
      points,
      tier: tierConfig.tier,
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

  const { gameId } = await prisma.$transaction(async (db) => {
    const gameResult = await db.gameResult.create({
      data: {
        userId,
        score: payload.totalScore,
        correctCount: payload.correctCount,
        totalQuestions: payload.totalQuestions,
        category: Category.FLAG,
        gameMode: GameMode.SINGLE,
        variant: GameVariant.FLAG_MASTER,
        details: details as unknown as Prisma.InputJsonValue,
      },
    });

    // Flag Master no actualiza highScore (legacy: solo Classic Single).
    await db.user.update({
      where: { id: userId },
      data: {
        gamesPlayed: { increment: 1 },
      },
    });

    return { gameId: gameResult.id };
  });

  // Flag Master no participa en el ranking global (solo Classic).
  // Las actualizaciones de leaderboard se omiten intencionalmente.

  const newAchievements = await evaluateAchievementsAfterGame({
    userId,
    correctCount: payload.correctCount,
    totalQuestions: payload.totalQuestions,
    score: payload.totalScore,
  }).catch(() => []);

  const accuracy = Math.round((payload.correctCount / payload.totalQuestions) * 100);

  return {
    gameId,
    totalScore: payload.totalScore,
    correctCount: payload.correctCount,
    totalQuestions: payload.totalQuestions,
    accuracy,
    isHighScore: false,
    newAchievements,
  };
}

export default router;
