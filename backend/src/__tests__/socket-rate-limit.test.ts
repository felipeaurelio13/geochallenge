import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io';
import {
  SocketRateLimiter,
  connectionLimiter,
  rateLimitSocketConnection,
  getClientIp,
} from '../sockets/socketRateLimiter.js';
import { isRateLimited } from '../sockets/duel.handler.js';

function createMockSocket(headers: Record<string, string | string[]> = {}, address?: string): Socket {
  return {
    handshake: {
      headers,
      address,
    },
  } as unknown as Socket;
}

describe('SocketRateLimiter', () => {
  it('permite solicitudes hasta el límite máximo dentro de la ventana', () => {
    const limiter = new SocketRateLimiter(1000, 3);
    const now = 100000;

    expect(limiter.isAllowed('user-1', now)).toBe(true);
    expect(limiter.isAllowed('user-1', now + 100)).toBe(true);
    expect(limiter.isAllowed('user-1', now + 200)).toBe(true);
    expect(limiter.isAllowed('user-1', now + 300)).toBe(false);
  });

  it('permite nuevas solicitudes una vez transcurrida la ventana de tiempo', () => {
    const limiter = new SocketRateLimiter(1000, 2);
    const now = 100000;

    expect(limiter.isAllowed('user-1', now)).toBe(true);
    expect(limiter.isAllowed('user-1', now + 100)).toBe(true);
    expect(limiter.isAllowed('user-1', now + 200)).toBe(false);

    // 1001 ms después, la primera solicitud ya expiró
    expect(limiter.isAllowed('user-1', now + 1050)).toBe(true);
  });

  it('permite reiniciar el contador manualmente con reset()', () => {
    const limiter = new SocketRateLimiter(1000, 1);
    expect(limiter.isAllowed('user-1')).toBe(true);
    expect(limiter.isAllowed('user-1')).toBe(false);

    limiter.reset('user-1');
    expect(limiter.isAllowed('user-1')).toBe(true);
  });

  it('aísla las cuotas entre distintas claves', () => {
    const limiter = new SocketRateLimiter(1000, 1);
    expect(limiter.isAllowed('user-1')).toBe(true);
    expect(limiter.isAllowed('user-2')).toBe(true);
    expect(limiter.isAllowed('user-1')).toBe(false);
    expect(limiter.isAllowed('user-2')).toBe(false);
  });
});

describe('getClientIp', () => {
  it('extrae la IP desde socket.handshake.address si no hay x-forwarded-for', () => {
    const socket = createMockSocket({}, '192.168.1.50');
    expect(getClientIp(socket)).toBe('192.168.1.50');
  });

  it('prioriza la primera IP de x-forwarded-for cuando existe cabecera de proxy', () => {
    const socket = createMockSocket({ 'x-forwarded-for': '203.0.113.195, 70.41.3.18' });
    expect(getClientIp(socket)).toBe('203.0.113.195');
  });

  it('soporta x-forwarded-for como array', () => {
    const socket = createMockSocket({ 'x-forwarded-for': ['203.0.113.196', '70.41.3.18'] });
    expect(getClientIp(socket)).toBe('203.0.113.196');
  });
});

describe('rateLimitSocketConnection middleware', () => {
  beforeEach(() => {
    connectionLimiter.reset();
  });

  it('permite conexión si la IP está dentro del límite permitido', () => {
    const socket = createMockSocket({}, '10.0.0.1');
    const next = vi.fn();

    rateLimitSocketConnection(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('bloquea la conexión con error cuando la IP supera el límite de conexiones', () => {
    const socket = createMockSocket({}, '10.0.0.2');
    const next = vi.fn();

    // Consumir el límite (60)
    for (let i = 0; i < 60; i++) {
      connectionLimiter.isAllowed('10.0.0.2');
    }

    rateLimitSocketConnection(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Demasiadas conexiones, intenta más tarde');
  });

  it('permite conexión si no se detecta IP (ej. tests internos o sockets mock)', () => {
    const socket = createMockSocket({}, '');
    const next = vi.fn();

    rateLimitSocketConnection(socket, next);

    expect(next).toHaveBeenCalledWith();
  });
});

describe('isRateLimited en duel.handler', () => {
  it('aplica rate limiting por usuario y evento', () => {
    const userId = `rate-test-user-${Date.now()}`;
    const event = 'test:event';

    // Máximo 2 solicitudes permitidas
    expect(isRateLimited(userId, event, 2)).toBe(false);
    expect(isRateLimited(userId, event, 2)).toBe(false);
    expect(isRateLimited(userId, event, 2)).toBe(true);
  });
});
