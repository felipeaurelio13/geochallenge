import { describe, expect, it, vi } from 'vitest';
import { calculateRetryAfterSeconds, createRedisRateLimitStore } from '../middleware/rateLimit.js';

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

  describe('createRedisRateLimitStore', () => {
    it('retorna undefined en entorno de test para usar MemoryStore seguro', () => {
      const store = createRedisRateLimitStore('test');
      expect(store).toBeUndefined();
    });

    it('instancia RedisStore con prefijo y sendCommand cuando forceEnabled es true', async () => {
      const mockSendCommand = vi.fn().mockResolvedValue('OK');
      const store = createRedisRateLimitStore('auth', {
        forceEnabled: true,
        sendCommand: mockSendCommand,
      });

      expect(store).toBeDefined();
      expect(store?.prefix).toBe('rl:auth:');

      // Verificamos que sendCommand delegue correctamente
      const res = await (store as any).sendCommand({
        command: ['PING'],
        isReadOnly: true,
      });
      expect(res).toBe('OK');
      expect(mockSendCommand).toHaveBeenCalledWith('PING');
    });
  });
});
