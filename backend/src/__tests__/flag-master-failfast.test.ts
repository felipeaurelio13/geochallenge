/**
 * P1 — Flag Master fail-fast: si Redis no puede persistir el plan de rondas
 * en /start, la partida NO arranca: 503 GAME_STATE_UNAVAILABLE sin gameId.
 */
import express from 'express';
import { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redisSet: vi.fn(),
  trackServerEvent: vi.fn(),
}));

vi.mock('../middleware/auth.js', () => ({
  authenticateJWT: (req: { user?: { userId: string } }, _res: unknown, next: () => void) => {
    req.user = { userId: 'user-1' };
    next();
  },
}));

vi.mock('../config/redis.js', () => ({
  // Redis caído: cualquier SET de la caché de sesión lanza error.
  getRedis: () => ({
    set: mocks.redisSet,
    get: vi.fn(() => Promise.resolve(null)),
    del: vi.fn(() => Promise.resolve(1)),
  }),
}));

vi.mock('../config/env.js', () => ({
  config: { game: { questionsPerGame: 10, timePerQuestion: 10, maxTimeBonus: 50, basePoints: 100, enableStreakSimpleScoring: true, soloModeScoringStrategy: 'simple_1_0', enableStreakUniqueQuestions: true, mechanics: { limits: { intel5050: 1, focusTime: 1, streakShield: 0 } } }, jwt: { secret: 'test-secret', expiresIn: '7d' } },
}));

vi.mock('../config/database.js', () => ({ prisma: {} }));

vi.mock('../services/flagMaster.service.js', () => ({
  buildFlagMasterRounds: vi.fn(async () =>
    Array.from({ length: 10 }, (_, i) => ({
      id: `fm-q-${i + 1}`,
      category: 'FLAG',
      questionText: `Flag ${i + 1}`,
      options: ['Correct', 'Wrong1', 'Wrong2', 'Wrong3'],
      difficulty: 'HARD',
      imageUrl: null,
      questionData: `Country ${i + 1}`,
      continent: 'Europe',
      correctAnswer: 'Correct',
      flagModifier: 'none' as const,
      multiplier: 1.0,
      tier: 1,
    })),
  ),
  getTierConfigForRound: vi.fn(() => ({ modifier: 'none' as const, multiplier: 1.0, tier: 1 })),
  scoreFlagMasterAnswer: vi.fn(() => ({ isCorrect: true, points: 100, correctAnswer: 'Correct', modifier: 'none', multiplier: 1.0 })),
}));

vi.mock('../services/telemetry.service.js', () => ({
  trackServerEvent: mocks.trackServerEvent,
}));

vi.mock('../services/achievement.service.js', () => ({
  evaluateAchievementsAfterGame: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/mastery.service.js', () => ({
  applyMasteryAttemptsForRun: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../utils/serverTiming.js', () => ({
  effectiveTimeRemainingSeconds: () => 10,
}));

import flagMasterRouter from '../controllers/flagMaster.controller.js';

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/game/flag-master', flagMasterRouter);
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, baseUrl };
}

describe('POST /game/flag-master/start — Redis fail-fast', () => {
  it('Redis caído durante start → 503 GAME_STATE_UNAVAILABLE y sin game usable', async () => {
    // Redis SET de la caché de sesión falla (fail-fast).
    mocks.redisSet.mockRejectedValue(new Error('connection lost'));

    const { server, baseUrl } = startServer();
    try {
      const res = await fetch(`${baseUrl}/api/game/flag-master/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      });
      expect(res.status).toBe(503);
      const body = await res.json() as { code: string; gameId?: string; rounds?: unknown };
      expect(body.code).toBe('GAME_STATE_UNAVAILABLE');
      // No se entrega una partida usable: sin gameId ni rounds.
      expect(body.gameId).toBeUndefined();
      expect(body.rounds).toBeUndefined();
      // La partida nunca se reportó como iniciada.
      expect(mocks.trackServerEvent).not.toHaveBeenCalled();
    } finally { server.close(); }
  });
});