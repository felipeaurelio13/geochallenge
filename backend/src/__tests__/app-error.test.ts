import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../utils/appError.js';
import { emitSocketError, respondWithError } from '../utils/respondWithError.js';

function createMockResponse() {
  const res: { statusCode?: number; body?: unknown; status: (c: number) => any; json: (b: unknown) => any } = {
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res;
}

describe('AppError', () => {
  it('expone code, status, message y params', () => {
    const err = new AppError('CHALLENGE_PLAYER_RANGE', 400, 'El desafío debe ser para entre 2 y 8 personas', {
      min: 2,
      max: 8,
    });

    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('CHALLENGE_PLAYER_RANGE');
    expect(err.status).toBe(400);
    expect(err.message).toBe('El desafío debe ser para entre 2 y 8 personas');
    expect(err.params).toEqual({ min: 2, max: 8 });
  });
});

describe('respondWithError', () => {
  it('responde con status/code/params del AppError y el mensaje en español como fallback', () => {
    const res = createMockResponse();
    const err = new AppError('CHALLENGE_FULL', 400, 'El desafío ya completó el cupo de jugadores');

    respondWithError(res as any, err);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: 'El desafío ya completó el cupo de jugadores',
      code: 'CHALLENGE_FULL',
    });
  });

  it('incluye params cuando el AppError los trae', () => {
    const res = createMockResponse();
    const err = new AppError('GAME_NOT_ENOUGH_QUESTIONS', 409, 'No hay suficientes preguntas disponibles', {
      available: 3,
      requested: 10,
    });

    respondWithError(res as any, err);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({
      code: 'GAME_NOT_ENOUGH_QUESTIONS',
      params: { available: 3, requested: 10 },
    });
  });

  it('un error no-AppError produce code INTERNAL con un requestId, sin filtrar el detalle', () => {
    const res = createMockResponse();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    respondWithError(res as any, new Error('boom: contraseña=secreta'));

    expect(res.statusCode).toBe(500);
    const body = res.body as { error: string; code: string; params: { requestId: string } };
    expect(body.error).toBe('Error interno del servidor');
    expect(body.code).toBe('INTERNAL');
    expect(body.params.requestId).toMatch(/^[0-9a-f]{8}$/);
    expect(JSON.stringify(body)).not.toMatch(/secreta/);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('respeta fallbackStatus para errores no-AppError', () => {
    const res = createMockResponse();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    respondWithError(res as any, new Error('oops'), 503);

    expect(res.statusCode).toBe(503);

    vi.restoreAllMocks();
  });
});

describe('emitSocketError', () => {
  it('emite { message, code, params } equivalentes al AppError', () => {
    const emitted: Array<{ event: string; payload: unknown }> = [];
    const fakeSocket = {
      emit: (event: string, payload: unknown) => emitted.push({ event, payload }),
    };

    emitSocketError(fakeSocket, 'duel:error', new AppError('DUEL_RATE_LIMITED', 429, 'Demasiadas solicitudes, intenta más tarde'));

    expect(emitted).toHaveLength(1);
    expect(emitted[0].event).toBe('duel:error');
    expect(emitted[0].payload).toEqual({
      message: 'Demasiadas solicitudes, intenta más tarde',
      code: 'DUEL_RATE_LIMITED',
    });
  });

  it('para errores no-AppError emite code INTERNAL', () => {
    const emitted: Array<{ event: string; payload: unknown }> = [];
    const fakeSocket = {
      emit: (event: string, payload: unknown) => emitted.push({ event, payload }),
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});

    emitSocketError(fakeSocket, 'survival:error', new Error('unexpected'));

    const payload = emitted[0].payload as { code: string; message: string };
    expect(payload.code).toBe('INTERNAL');
    expect(payload.message).toBe('Error interno del servidor');

    vi.restoreAllMocks();
  });
});
