import express from 'express';
import { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';

import geoChallengeRouter from '../controllers/geoChallenge.controller.js';

const redisStore = new Map<string, string>();

vi.mock('../config/redis.js', () => ({
  getRedis: vi.fn(() => ({
    get: vi.fn((key: string) => Promise.resolve(redisStore.get(key) ?? null)),
    set: vi.fn((key: string, value: string, ...args: string[]) => {
      redisStore.set(key, value);
      return Promise.resolve('OK');
    }),
  })),
}));

vi.mock('../config/database.js', () => {
  const prismaStub = {
    gameResult: { create: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
    user: { update: vi.fn() },
  };
  return {
    prisma: {
      $transaction: vi.fn((fn: (stub: typeof prismaStub) => Promise<unknown>) => fn(prismaStub)),
      ...prismaStub,
    },
  };
});

vi.mock('../middleware/auth.js', () => ({
  authenticateJWT: (req: { user?: { userId: string } }, _res: unknown, next: () => void) => {
    req.user = { userId: 'user-1' };
    next();
  },
}));

interface PublicRound {
  id: string;
  options: Array<{ id: string }>;
  correctOptionIds?: string[];
  explanation?: unknown;
}

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/game/geo-challenges', geoChallengeRouter);
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, baseUrl };
}

describe('GeoRetos HTTP contract', () => {
  it('keeps solutions private and validates the five-round result on the server', async () => {
    const { server, baseUrl } = startServer();
    try {
      const startResponse = await fetch(`${baseUrl}/api/game/geo-challenges/start`);
      const game = await startResponse.json() as {
        gameId: string;
        engineVersion: string;
        sessionToken: string;
        rounds: PublicRound[];
      };

      expect(startResponse.status).toBe(200);
      expect(game.engineVersion).toBe('v2');
      expect(game.rounds).toHaveLength(7);
      expect(game.sessionToken).not.toContain(game.rounds[0].id);
      for (const round of game.rounds) {
        expect(round).not.toHaveProperty('correctOptionIds');
        expect(round).not.toHaveProperty('explanation');
      }

      const authoritativeAnswers = [];
      for (const round of game.rounds) {
        const answerResponse = await fetch(`${baseUrl}/api/game/geo-challenges/answer`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionToken: game.sessionToken,
            roundId: round.id,
            selectedOptionIds: [round.options[0].id],
          }),
        });
        const answer = await answerResponse.json() as { correctOptionIds: string[] };
        expect(answerResponse.status).toBe(200);
        authoritativeAnswers.push({ roundId: round.id, selectedOptionIds: answer.correctOptionIds });
      }

      const finishResponse = await fetch(`${baseUrl}/api/game/geo-challenges/finish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionToken: game.sessionToken, answers: authoritativeAnswers }),
      });
      const result = await finishResponse.json() as {
        gameId: string;
        correctCount: number;
        totalRounds: number;
        totalScore: number;
      };

      expect(finishResponse.status).toBe(200);
      expect(result).toMatchObject({
        gameId: game.gameId,
        totalRounds: 7,
      });

      // Tampered finish: even with forged round IDs, the server uses stored answers.
      // Client can't cheat /finish by sending correct answers after probing /answer.
      const tamperedAnswers = [
        ...authoritativeAnswers.slice(0, 4),
        { roundId: 'not-in-this-session', selectedOptionIds: ['CL'] },
      ];
      const tamperedResponse = await fetch(`${baseUrl}/api/game/geo-challenges/finish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionToken: game.sessionToken, answers: tamperedAnswers }),
      });
      expect(tamperedResponse.status).toBe(200); // server uses stored answers, not client input
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });

  it('rejects a session token that was not signed by the server', async () => {
    const { server, baseUrl } = startServer();
    try {
      const response = await fetch(`${baseUrl}/api/game/geo-challenges/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sessionToken: 'forged-token',
          roundId: 'round-1',
          selectedOptionIds: ['CL'],
        }),
      });
      const body = await response.json() as { code: string };

      expect(response.status).toBe(403);
      expect(body.code).toBe('GEO_SESSION_EXPIRED');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });
});
