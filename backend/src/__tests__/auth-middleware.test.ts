import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateJWT, optionalAuth, generateToken, type AuthRequest } from '../middleware/auth.js';
import { config } from '../config/env.js';

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

  it('autentica exitosamente un token generado con HS256', async () => {
    const payload = { userId: 'u1', username: 'tester', email: 'test@example.com' };
    const token = generateToken(payload);
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    await authenticateJWT(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user?.userId).toBe('u1');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rechaza un token firmado con un algoritmo no permitido (ej. HS512)', async () => {
    const payload = { userId: 'u2', username: 'attacker', email: 'att@example.com' };
    const token = jwt.sign(payload, config.jwt.secret, { algorithm: 'HS512' });
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    await authenticateJWT(req, res, next);

    expect(req.user).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('optionalAuth', () => {
  it('permite acceso sin usuario cuando el token usa un algoritmo no permitido', async () => {
    const payload = { userId: 'u3', username: 'unknown', email: 'u3@example.com' };
    const token = jwt.sign(payload, config.jwt.secret, { algorithm: 'HS512' });
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    await optionalAuth(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
