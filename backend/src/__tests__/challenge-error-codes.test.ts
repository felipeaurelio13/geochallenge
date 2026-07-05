import express from 'express';
import { AddressInfo } from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import challengeRouter from '../controllers/challenge.controller.js';
import { challengeService } from '../services/challenge.service.js';
import { AppError } from '../utils/appError.js';

vi.mock('../middleware/auth.js', () => ({
  authenticateJWT: (req: { user?: { userId: string } }, _res: unknown, next: () => void) => {
    req.user = { userId: 'user-1' };
    next();
  },
}));

function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/challenges', challengeRouter);
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, baseUrl };
}

describe('challenge.service — throw sites migrados a AppError', () => {
  it('createChallenge con maxPlayers fuera de rango lanza AppError con code y params', async () => {
    await expect(
      challengeService.createChallenge('creator-1', ['MIXED'], 1, 20)
    ).rejects.toMatchObject({
      code: 'CHALLENGE_PLAYER_RANGE',
      status: 400,
      message: 'El desafío debe ser para entre 2 y 8 personas',
      params: { min: 2, max: 8 },
    });

    await expect(
      challengeService.createChallenge('creator-1', ['MIXED'], 9, 20)
    ).rejects.toBeInstanceOf(AppError);
  });

  it('createChallenge con answerTimeSeconds inválido lanza AppError', async () => {
    await expect(
      challengeService.createChallenge('creator-1', ['MIXED'], 4, 15)
    ).rejects.toMatchObject({
      code: 'CHALLENGE_INVALID_ANSWER_TIME',
      status: 400,
    });
  });
});

describe('POST /api/challenges — respuesta HTTP incluye code y params del AppError', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('responde 400 con code CHALLENGE_PLAYER_RANGE cuando el service lanza ese AppError', async () => {
    vi.spyOn(challengeService, 'createChallenge').mockRejectedValue(
      new AppError('CHALLENGE_PLAYER_RANGE', 400, 'El desafío debe ser para entre 2 y 8 personas', {
        min: 2,
        max: 8,
      })
    );

    // maxPlayers=4 pasa la validación Zod del router (min 2, max 8) — el
    // AppError viene del service mockeado, no de un 400 de validación previo.
    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/challenges`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ categories: ['MIXED'], maxPlayers: 4, answerTimeSeconds: 20 }),
    });
    const body = (await response.json()) as { error: string; code: string; params: unknown };
    server.close();

    expect(response.status).toBe(400);
    expect(body.code).toBe('CHALLENGE_PLAYER_RANGE');
    expect(body.params).toEqual({ min: 2, max: 8 });
    expect(body.error).toBe('El desafío debe ser para entre 2 y 8 personas');
  });

  it('un error no-AppError del service responde 400 (fallback del controller) con code INTERNAL', async () => {
    vi.spyOn(challengeService, 'createChallenge').mockRejectedValue(new Error('db down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { server, baseUrl } = startServer();
    const response = await fetch(`${baseUrl}/api/challenges`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ categories: ['MIXED'], maxPlayers: 4, answerTimeSeconds: 20 }),
    });
    const body = (await response.json()) as { code: string; params: { requestId: string } };
    server.close();

    expect(response.status).toBe(400);
    expect(body.code).toBe('INTERNAL');
    expect(body.params.requestId).toMatch(/^[0-9a-f]{8}$/);
  });
});
