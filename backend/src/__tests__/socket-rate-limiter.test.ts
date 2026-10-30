import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createSocketEventRateLimiter } from '../sockets/rateLimiter.js';

describe('createSocketEventRateLimiter', () => {
  let emittedEvents: Array<{ event: string; data: any }> = [];
  let mockSocket: { emit: (event: string, data: any) => void };

  beforeEach(() => {
    emittedEvents = [];
    mockSocket = {
      emit: (event: string, data: any) => {
        emittedEvents.push({ event, data });
        return true;
      },
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('permite eventos sucesivos dentro de la capacidad configurada', () => {
    const limiter = createSocketEventRateLimiter(mockSocket, { capacity: 5, refillRate: 1 });
    const next = vi.fn();

    for (let i = 0; i < 5; i++) {
      limiter(['duel:answer', { questionId: `q-${i}` }], next);
    }

    expect(next).toHaveBeenCalledTimes(5);
    expect(next).toHaveBeenLastCalledWith();
    expect(emittedEvents).toHaveLength(0);
  });

  it('bloquea eventos y emite duel:error cuando se agotan los tokens en eventos de duelo', () => {
    const limiter = createSocketEventRateLimiter(mockSocket, { capacity: 2, refillRate: 1 });
    const next = vi.fn();

    limiter(['duel:queue', {}], next);
    limiter(['duel:answer', {}], next);
    expect(next).toHaveBeenCalledTimes(2);

    // Tercer evento excede el límite
    limiter(['duel:answer', {}], next);
    expect(next).toHaveBeenCalledTimes(3);
    expect(next.mock.calls[2][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[2][0]?.message).toBe('SOCKET_RATE_LIMIT_EXCEEDED');

    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0].event).toBe('duel:error');
    expect(emittedEvents[0].data).toMatchObject({
      code: 'RATE_LIMITED',
      message: 'Demasiadas solicitudes en tiempo real, intenta de nuevo más tarde',
      params: { retryAfterSeconds: expect.any(Number) },
    });
  });

  it('bloquea eventos y emite survival:error en eventos de survival', () => {
    const limiter = createSocketEventRateLimiter(mockSocket, { capacity: 1, refillRate: 1 });
    const next = vi.fn();

    limiter(['survival:answer', {}], next);
    limiter(['survival:answer', {}], next);

    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0].event).toBe('survival:error');
    expect(emittedEvents[0].data.code).toBe('RATE_LIMITED');
  });

  it('bloquea eventos y emite error genérico en otros eventos no prefijados', () => {
    const limiter = createSocketEventRateLimiter(mockSocket, { capacity: 1, refillRate: 1 });
    const next = vi.fn();

    limiter(['custom:event', {}], next);
    limiter(['custom:event', {}], next);

    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0].event).toBe('error');
    expect(emittedEvents[0].data.code).toBe('RATE_LIMITED');
  });

  it('rellena tokens con el paso del tiempo y permite nuevos eventos', () => {
    const limiter = createSocketEventRateLimiter(mockSocket, { capacity: 2, refillRate: 2 });
    const next = vi.fn();

    limiter(['duel:answer', {}], next);
    limiter(['duel:answer', {}], next);
    // Agotado
    limiter(['duel:answer', {}], next);
    expect(emittedEvents).toHaveLength(1);

    // Avanzar 1 segundo (rellena 2 tokens a refillRate = 2)
    vi.advanceTimersByTime(1000);

    const nextAfterWait = vi.fn();
    limiter(['duel:answer', {}], nextAfterWait);
    expect(nextAfterWait).toHaveBeenCalledWith();
    // No se emitió ningún error nuevo
    expect(emittedEvents).toHaveLength(1);
  });
});
