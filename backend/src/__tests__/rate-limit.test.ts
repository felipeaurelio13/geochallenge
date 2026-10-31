import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  calculateRetryAfterSeconds,
  checkSocketHandshakeRate,
  extractClientIp,
  resetSocketHandshakeStore,
  socketHandshakeAllowRequest,
  socketHandshakeExpressLimiter,
} from '../middleware/rateLimit.js';

describe('rate limit helpers', () => {
  it('calcula segundos restantes con techo y mínimo de 1', () => {
    const now = new Date('2026-02-15T10:00:00.000Z').getTime();
    const resetAt = new Date('2026-02-15T10:00:07.200Z');

    expect(calculateRetryAfterSeconds(resetAt, now)).toBe(8);
  });

  it('retorna 1 segundo si el reset ya pasó', () => {
    const now = new Date('2026-02-15T10:00:00.000Z').getTime();
    const resetAt = new Date('2026-02-15T09:59:59.000Z');

    expect(calculateRetryAfterSeconds(resetAt, now)).toBe(1);
  });

  it('retorna fallback seguro cuando no hay resetTime', () => {
    expect(calculateRetryAfterSeconds(undefined, Date.now())).toBe(60);
  });
});

describe('Socket.IO handshake rate limiting (OWASP API4:2023)', () => {
  beforeEach(() => {
    resetSocketHandshakeStore();
  });

  describe('extractClientIp', () => {
    it('extrae IP desde string x-forwarded-for con proxies', () => {
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' },
      };
      expect(extractClientIp(req)).toBe('203.0.113.195');
    });

    it('extrae IP desde array x-forwarded-for', () => {
      const req = {
        headers: { 'x-forwarded-for': ['198.51.100.42', '10.0.0.1'] },
      };
      expect(extractClientIp(req)).toBe('198.51.100.42');
    });

    it('usa remoteAddress de socket como fallback cuando no hay cabeceras proxy', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.50' },
      };
      expect(extractClientIp(req)).toBe('192.168.1.50');
    });

    it('retorna unknown si no hay socket ni cabeceras', () => {
      const req = { headers: {} };
      expect(extractClientIp(req)).toBe('unknown');
    });
  });

  describe('checkSocketHandshakeRate', () => {
    it('permite solicitudes dentro del límite y bloquea al exceder', () => {
      const ip = '10.10.10.10';
      const now = 1000000;
      const max = 3;
      const windowMs = 60000;

      expect(checkSocketHandshakeRate(ip, now, max, windowMs)).toEqual({
        allowed: true,
        retryAfterSeconds: 0,
      });
      expect(checkSocketHandshakeRate(ip, now + 100, max, windowMs)).toEqual({
        allowed: true,
        retryAfterSeconds: 0,
      });
      expect(checkSocketHandshakeRate(ip, now + 200, max, windowMs)).toEqual({
        allowed: true,
        retryAfterSeconds: 0,
      });

      // Cuarta solicitud excede el límite
      const blocked = checkSocketHandshakeRate(ip, now + 300, max, windowMs);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
    });

    it('aísla contadores entre diferentes IPs', () => {
      const ipA = '1.1.1.1';
      const ipB = '2.2.2.2';
      const now = 1000000;
      const max = 1;

      expect(checkSocketHandshakeRate(ipA, now, max).allowed).toBe(true);
      expect(checkSocketHandshakeRate(ipA, now, max).allowed).toBe(false);

      // ipB no debe verse afectada por ipA
      expect(checkSocketHandshakeRate(ipB, now, max).allowed).toBe(true);
    });

    it('reinicia contador una vez expirada la ventana de tiempo', () => {
      const ip = '3.3.3.3';
      const t0 = 1000000;
      const max = 1;
      const windowMs = 5000;

      expect(checkSocketHandshakeRate(ip, t0, max, windowMs).allowed).toBe(true);
      expect(checkSocketHandshakeRate(ip, t0 + 1000, max, windowMs).allowed).toBe(false);

      // Después de expirar windowMs
      const tAfter = t0 + windowMs + 100;
      expect(checkSocketHandshakeRate(ip, tAfter, max, windowMs).allowed).toBe(true);
    });
  });

  describe('socketHandshakeAllowRequest (Engine.IO integration)', () => {
    it('llama callback con (null, true) cuando el cliente está bajo el límite', () => {
      const req = {
        headers: { 'x-forwarded-for': '185.220.101.5' },
      };
      const callback = vi.fn();

      socketHandshakeAllowRequest(req, callback);

      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('llama callback con error y false cuando el cliente excede el límite', () => {
      const req = {
        headers: { 'x-forwarded-for': '185.220.101.99' },
      };
      const callback = vi.fn();

      // Consumir el cupo (SOCKET_HANDSHAKE_MAX = 60)
      for (let i = 0; i < 60; i++) {
        socketHandshakeAllowRequest(req, callback);
      }
      expect(callback).toHaveBeenLastCalledWith(null, true);

      // Intento 61 excede
      socketHandshakeAllowRequest(req, callback);
      expect(callback).toHaveBeenLastCalledWith(
        expect.stringContaining('Demasiadas solicitudes de conexión'),
        false
      );
    });
  });

  describe('socketHandshakeExpressLimiter (Express middleware)', () => {
    it('pasa la solicitud con next() cuando está dentro del límite', () => {
      const req = {
        ip: '192.0.2.1',
        headers: {},
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      socketHandshakeExpressLimiter(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('responde 429 RATE_LIMITED cuando la IP satura las solicitudes', () => {
      const req = {
        ip: '192.0.2.200',
        headers: {},
      } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      for (let i = 0; i < 60; i++) {
        socketHandshakeExpressLimiter(req, res, next);
      }
      expect(next).toHaveBeenCalledTimes(60);

      // Intento 61
      socketHandshakeExpressLimiter(req, res, next);
      expect(next).toHaveBeenCalledTimes(60);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'RATE_LIMITED',
          error: 'Demasiadas solicitudes de conexión, intenta de nuevo más tarde',
          retryAfterSeconds: expect.any(Number),
        })
      );
    });
  });
});
