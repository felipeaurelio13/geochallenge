import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import {
  authenticateJWT,
  optionalAuth,
  generateToken,
  ALLOWED_JWT_ALGORITHMS,
  type AuthRequest,
} from '../middleware/auth.js';

function createResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  return res;
}

describe('authenticateJWT', () => {
  const validPayload = {
    userId: 'user-789',
    username: 'testplayer',
    email: 'player@geochallenge.com',
  };

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

  it('autentica exitosamente con token HS256 válido', async () => {
    const token = generateToken(validPayload);
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    await authenticateJWT(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user?.userId).toBe(validPayload.userId);
    expect(req.user?.username).toBe(validPayload.username);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rechaza token firmado con algoritmo no permitido (HS384)', async () => {
    const forbiddenToken = jwt.sign(validPayload, config.jwt.secret, { algorithm: 'HS384' });
    const req = { headers: { authorization: `Bearer ${forbiddenToken}` } } as unknown as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    await authenticateJWT(req, res, next);

    expect(req.user).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza token expirado con status 401', async () => {
    const expiredToken = jwt.sign(validPayload, config.jwt.secret, { algorithm: 'HS256', expiresIn: '-1s' });
    const req = { headers: { authorization: `Bearer ${expiredToken}` } } as unknown as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    await authenticateJWT(req, res, next);

    expect(req.user).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token expirado' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('optionalAuth', () => {
  const validPayload = {
    userId: 'user-optional',
    username: 'optplayer',
    email: 'opt@geochallenge.com',
  };

  it('continúa sin usuario cuando no hay cabecera Authorization', async () => {
    const req = { headers: {} } as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    await optionalAuth(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('asigna req.user cuando el token HS256 es válido', async () => {
    const token = generateToken(validPayload);
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    await optionalAuth(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user?.userId).toBe(validPayload.userId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('continúa sin usuario si el algoritmo del token no está permitido', async () => {
    const token384 = jwt.sign(validPayload, config.jwt.secret, { algorithm: 'HS384' });
    const req = { headers: { authorization: `Bearer ${token384}` } } as unknown as AuthRequest;
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    await optionalAuth(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('generateToken and algorithm configuration', () => {
  it('ALLOWED_JWT_ALGORITHMS sólo incluye HS256', () => {
    expect(ALLOWED_JWT_ALGORITHMS).toEqual(['HS256']);
  });

  it('generateToken emite encabezado alg: HS256', () => {
    const token = generateToken({ userId: 'u1', username: 'p1', email: 'e1@test.com' });
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64').toString());
    expect(header.alg).toBe('HS256');
  });
});
