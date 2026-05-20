import Redis from 'ioredis';
import { config } from './env.js';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      // Sin commandTimeout, un comando contra un Redis caído queda colgado ~8s
      // mientras ioredis reintenta. Eso vuelve lentísimo /health (lo invoca el
      // keep-alive del cliente) y satura el pool de 6 conexiones del navegador,
      // dejando sin slot a requests reales (ranking, etc.). Lo acotamos a 3s.
      commandTimeout: 3000,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redis.on('error', (err) => {
      console.error('❌ Redis connection error:', err.message);
    });
  }

  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log('Redis disconnected');
  }
}
