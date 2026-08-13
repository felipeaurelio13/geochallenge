import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Router, Response } from 'express';
import { z } from 'zod';
import { GameMode, GameVariant, Category, Prisma } from '@prisma/client';
import { authenticateJWT, AuthRequest } from '../middleware/auth.js';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';
import { getRedis } from '../config/redis.js';
import { respondWithError } from '../utils/respondWithError.js';
import {
  buildGeoChallengeGame,
  isGeoChallengeAnswerCorrect,
  LocalizedText,
  toPublicGeoChallengeRound,
  getGeoChallengeBasePoints,
  GeoChallengeDifficulty,
} from '../services/geoChallenge.service.js';
import { trackServerEvent } from '../services/telemetry.service.js';

const router = Router();

const GEO_ANSWER_TTL = 60 * 60 * 2; // 2h

function geoAnswerKey(gameId: string, roundId: string): string {
  return `geo:answer:${gameId}:${roundId}`;
}

interface SessionRound {
  id: string;
  kind: string;
  region: string;
  difficulty?: GeoChallengeDifficulty;
  correctOptionIds: string[];
  explanation: LocalizedText;
  answeredOptionIds?: string[];
}

interface GeoChallengeSessionPayload {
  scope: 'geo-challenges';
  gameId: string;
  userId: string;
  dataVersion: string;
  engineVersion?: 'v1' | 'v2';
  expiresAt: number;
  rounds: SessionRound[];
}

const answerSchema = z.object({
  sessionToken: z.string().min(1),
  roundId: z.string().min(1),
  selectedOptionIds: z.array(z.string().min(1)).max(4),
});

const finishSchema = z.object({
  sessionToken: z.string().min(1),
  answers: z.array(z.object({
    roundId: z.string().min(1),
    selectedOptionIds: z.array(z.string().min(1)).max(4),
  })).max(10).optional(),
});

const SESSION_DURATION_MS = 60 * 60 * 1000;
const SESSION_ALGORITHM = 'aes-256-gcm';
const SESSION_KEY = createHash('sha256').update(config.jwt.secret).digest();

function signSession(payload: Omit<GeoChallengeSessionPayload, 'expiresAt'>): string {
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv(SESSION_ALGORITHM, SESSION_KEY, initializationVector);
  const plaintext = JSON.stringify({ ...payload, expiresAt: Date.now() + SESSION_DURATION_MS });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authenticationTag = cipher.getAuthTag();
  return [initializationVector, authenticationTag, encrypted]
    .map((part) => part.toString('base64url'))
    .join('.');
}

function verifySession(token: string, userId: string | undefined): GeoChallengeSessionPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Sesión GeoRetos inválida');
  const [initializationVector, authenticationTag, encrypted] = parts.map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv(SESSION_ALGORITHM, SESSION_KEY, initializationVector);
  decipher.setAuthTag(authenticationTag);
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  const decoded = JSON.parse(plaintext) as Partial<GeoChallengeSessionPayload>;
  if (
    decoded.scope !== 'geo-challenges' ||
    typeof decoded.gameId !== 'string' ||
    typeof decoded.userId !== 'string' ||
    decoded.userId !== userId ||
    typeof decoded.expiresAt !== 'number' ||
    decoded.expiresAt <= Date.now() ||
    !Array.isArray(decoded.rounds)
  ) {
    throw new Error('Sesión GeoRetos inválida');
  }
  return decoded as GeoChallengeSessionPayload;
}

router.get('/start', authenticateJWT, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Autenticación requerida', code: 'AUTH_REQUIRED' });
    return;
  }
  const game = buildGeoChallengeGame();
  const sessionToken = signSession({
    scope: 'geo-challenges',
    gameId: game.gameId,
    userId: req.user.userId,
    dataVersion: game.dataVersion,
    engineVersion: game.engineVersion,
    rounds: game.rounds.map((round) => ({
      id: round.id,
      kind: round.kind,
      region: round.region,
      difficulty: round.difficulty,
      correctOptionIds: round.correctOptionIds,
      explanation: round.explanation,
    })),
  });

  res.json({
    gameId: game.gameId,
    sessionToken,
    timePerRound: game.timePerRound,
    dataVersion: game.dataVersion,
    dataUpdatedAt: game.dataUpdatedAt,
    rounds: game.rounds.map(toPublicGeoChallengeRound),
  });

  trackServerEvent({
    name: 'game_started',
    userId: req.user.userId,
    runId: game.gameId,
    gameMode: GameMode.SINGLE,
    variant: GameVariant.GEO_CHALLENGE,
    category: Category.MIXED,
    properties: {
      engineVersion: 'v2',
      totalRounds: game.rounds.length,
    },
  });
});

router.post('/answer', authenticateJWT, async (req: AuthRequest, res: Response) => {
  const validation = answerSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ error: 'Respuesta inválida', code: 'VALIDATION_FAILED' });
    return;
  }

  let session: GeoChallengeSessionPayload;
  try {
    session = verifySession(validation.data.sessionToken, req.user?.userId);
  } catch {
    res.status(403).json({ error: 'La sesión expiró. Inicia un nuevo GeoReto.', code: 'GEO_SESSION_EXPIRED' });
    return;
  }

  const round = session.rounds.find((candidate) => candidate.id === validation.data.roundId);
  if (!round) {
    res.status(404).json({ error: 'Ronda no encontrada', code: 'GEO_ROUND_NOT_FOUND' });
    return;
  }

  const answerKey = geoAnswerKey(session.gameId, round.id);
  const isCorrect = isGeoChallengeAnswerCorrect(round.correctOptionIds, validation.data.selectedOptionIds);
  const basePoints = getGeoChallengeBasePoints(round.difficulty);
  const points = isCorrect ? basePoints : 0;
  const candidate = {
    roundId: round.id, isCorrect,
    correctOptionIds: round.correctOptionIds, explanation: round.explanation,
    points,
  };

  try {
    const redis = getRedis();
    const nxResult = await redis.set(answerKey, JSON.stringify(candidate), 'EX', GEO_ANSWER_TTL, 'NX');
    if (nxResult === 'OK') {
      trackServerEvent({
        name: 'question_answered',
        userId: session.userId,
        runId: session.gameId,
        questionId: round.id,
        gameMode: GameMode.SINGLE,
        variant: GameVariant.GEO_CHALLENGE,
        properties: {
          engineVersion: 'v2',
          isCorrect,
          kind: round.kind,
          region: round.region,
          difficulty: round.difficulty,
          points,
        },
      });
      res.json(candidate); return;
    }
    const winner = await redis.get(answerKey);
    if (winner) { res.json(JSON.parse(winner)); return; }
    res.status(503).json({ error: 'Servicio no disponible.', code: 'GAME_STATE_UNAVAILABLE' });
  } catch {
    res.status(503).json({ error: 'Servicio no disponible.', code: 'GAME_STATE_UNAVAILABLE' });
  }
});

router.post('/finish', authenticateJWT, async (req: AuthRequest, res: Response) => {
  const validation = finishSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ error: 'Resultado inválido', code: 'VALIDATION_FAILED' });
    return;
  }

  try {
    const session = verifySession(validation.data.sessionToken, req.user?.userId);

    const details: Array<{
      roundId: string;
      kind: string;
      region: string;
      difficulty?: GeoChallengeDifficulty;
      isCorrect: boolean;
      points: number;
    }> = [];
    let redisAvailable = true;

    try {
      const redis = getRedis();
      for (const round of session.rounds) {
        const answerKey = geoAnswerKey(session.gameId, round.id);
        const stored = await redis.get(answerKey);
        if (stored) {
          const parsed = JSON.parse(stored) as { isCorrect: boolean; points: number };
          details.push({
            roundId: round.id,
            kind: round.kind,
            region: round.region,
            difficulty: round.difficulty,
            isCorrect: parsed.isCorrect,
            points: parsed.points ?? 0,
          });
        } else {
          details.push({
            roundId: round.id,
            kind: round.kind,
            region: round.region,
            difficulty: round.difficulty,
            isCorrect: false,
            points: 0,
          });
        }
      }
    } catch {
      res.status(503).json({ error: 'Servicio no disponible. Intenta de nuevo.', code: 'GAME_STATE_UNAVAILABLE' });
      return;
    }

    const correctCount = details.filter((detail) => detail.isCorrect).length;
    const totalScore = details.reduce((sum, detail) => sum + detail.points, 0);

    const userId = req.user!.userId;
    try {
      await prisma.$transaction(async (db) => {
        const existing = await db.gameResult.findUnique({ where: { runId: session.gameId } });
        if (existing) return;

        await db.gameResult.create({
          data: {
            userId,
            score: totalScore,
            correctCount,
            totalQuestions: session.rounds.length,
            category: 'MIXED',
            gameMode: GameMode.SINGLE,
            variant: GameVariant.GEO_CHALLENGE,
            runId: session.gameId,
            details: {
              engineVersion: 'v2',
              dataVersion: session.dataVersion,
              rounds: details,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await db.user.update({
          where: { id: userId },
          data: { gamesPlayed: { increment: 1 } },
        });
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        // concurrent finish: already persisted, no side effects
      } else {
        throw err;
      }
    }

    trackServerEvent({
      name: 'game_finished',
      userId,
      runId: session.gameId,
      gameMode: GameMode.SINGLE,
      variant: GameVariant.GEO_CHALLENGE,
      category: Category.MIXED,
      properties: {
        engineVersion: 'v2',
        score: totalScore,
        correctCount,
        totalQuestions: session.rounds.length,
        accuracy: Math.round((correctCount / session.rounds.length) * 100),
      },
    });

    res.json({
      gameId: session.gameId,
      correctCount,
      totalRounds: session.rounds.length,
      totalScore,
      details,
    });
  } catch (err) {
    respondWithError(res, err as Error);
  }
});

export default router;
