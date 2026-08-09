import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Router, Response } from 'express';
import { z } from 'zod';
import { GameMode, GameVariant, Prisma } from '@prisma/client';
import { authenticateJWT, AuthRequest } from '../middleware/auth.js';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';
import {
  buildGeoChallengeGame,
  isGeoChallengeAnswerCorrect,
  LocalizedText,
  toPublicGeoChallengeRound,
} from '../services/geoChallenge.service.js';

const router = Router();

interface SessionRound {
  id: string;
  kind: string;
  region: string;
  correctOptionIds: string[];
  explanation: LocalizedText;
}

interface GeoChallengeSessionPayload {
  scope: 'geo-challenges';
  gameId: string;
  userId: string;
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
  })).length(5),
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
    rounds: game.rounds.map((round) => ({
      id: round.id,
      kind: round.kind,
      region: round.region,
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
});

router.post('/answer', authenticateJWT, (req: AuthRequest, res: Response) => {
  const validation = answerSchema.safeParse(req.body);
  if (!validation.success) {
    res.status(400).json({ error: 'Respuesta inválida', code: 'VALIDATION_FAILED' });
    return;
  }

  try {
    const session = verifySession(validation.data.sessionToken, req.user?.userId);
    const round = session.rounds.find((candidate) => candidate.id === validation.data.roundId);
    if (!round) {
      res.status(404).json({ error: 'Ronda no encontrada', code: 'GEO_ROUND_NOT_FOUND' });
      return;
    }
    const isCorrect = isGeoChallengeAnswerCorrect(round.correctOptionIds, validation.data.selectedOptionIds);
    res.json({
      roundId: round.id,
      isCorrect,
      correctOptionIds: round.correctOptionIds,
      explanation: round.explanation,
      points: isCorrect ? 100 : 0,
    });
  } catch {
    res.status(403).json({ error: 'La sesión expiró. Inicia un nuevo GeoReto.', code: 'GEO_SESSION_EXPIRED' });
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
    const submittedByRound = new Map(validation.data.answers.map((answer) => [answer.roundId, answer]));
    const sessionRoundIds = new Set(session.rounds.map((round) => round.id));
    const hasOnlySessionRounds = [...submittedByRound.keys()].every((roundId) => sessionRoundIds.has(roundId));
    if (submittedByRound.size !== session.rounds.length || !hasOnlySessionRounds) {
      res.status(400).json({ error: 'Faltan rondas por responder', code: 'GEO_INCOMPLETE_GAME' });
      return;
    }
    const details = session.rounds.map((round) => {
      const answer = submittedByRound.get(round.id);
      const isCorrect = answer
        ? isGeoChallengeAnswerCorrect(round.correctOptionIds, answer.selectedOptionIds)
        : false;
      return { roundId: round.id, kind: round.kind, region: round.region, isCorrect };
    });
    const correctCount = details.filter((detail) => detail.isCorrect).length;
    const totalScore = correctCount * 100;

    // Persistir GameResult para GeoRetos (best-effort: el resultado se devuelve igual aunque la DB falle).
    const userId = req.user!.userId;
    try {
      await prisma.$transaction(async (db) => {
        await db.gameResult.create({
          data: {
            userId,
            score: totalScore,
            correctCount,
            totalQuestions: session.rounds.length,
            category: 'MIXED',
            gameMode: GameMode.SINGLE,
            variant: GameVariant.GEO_CHALLENGE,
            details: { dataVersion: req.body.dataVersion, rounds: details } as unknown as Prisma.InputJsonValue,
          },
        });

        await db.user.update({
          where: { id: userId },
          data: { gamesPlayed: { increment: 1 } },
        });
      });
    } catch (err) {
      console.error('[geo-challenge] Failed to persist game result:', err);
    }

    res.json({
      gameId: session.gameId,
      correctCount,
      totalRounds: session.rounds.length,
      totalScore,
      details,
    });
  } catch {
    res.status(403).json({ error: 'La sesión expiró. Inicia un nuevo GeoReto.', code: 'GEO_SESSION_EXPIRED' });
  }
});

export default router;
