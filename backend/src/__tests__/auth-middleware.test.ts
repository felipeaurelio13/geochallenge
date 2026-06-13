import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import { authenticateJWT, type AuthRequest } from '../middleware/auth.js';

function createResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  return res;
}

describe('authenticateJWT', () => {
  it('devuelve 401 cuando no hay JWT ni bypass válido', async () => {
    const req = { headers: {} } as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    await authenticateJWT(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token de autenticación requerido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('no autentica una request con bypass inválido', async () => {
    const req = { headers: { 'x-test-auth-bypass': 'wrong-secret' } } as unknown as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    await authenticateJWT(req, res, next);

    expect(req.user).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
