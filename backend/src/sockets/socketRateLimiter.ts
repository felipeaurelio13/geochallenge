import type { Socket } from 'socket.io';

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
}

/**
 * Limitador en memoria con ventana deslizante y limpieza periódica de claves inactivas.
 * Protege contra Unrestricted Resource Consumption (OWASP API4:2023)
 * sin acumular memoria indefinidamente.
 */
export class SocketRateLimiter {
  private attempts = new Map<string, number[]>();
  private lastCleanup = Date.now();

  constructor(
    public readonly windowMs: number,
    public readonly max: number
  ) {}

  isAllowed(key: string, now: number = Date.now()): boolean {
    this.cleanup(now);
    const cutoff = now - this.windowMs;
    const timestamps = this.attempts.get(key);

    if (!timestamps) {
      this.attempts.set(key, [now]);
      return true;
    }

    const recent = timestamps.filter((t) => t > cutoff);
    if (recent.length >= this.max) {
      this.attempts.set(key, recent);
      return false;
    }

    recent.push(now);
    this.attempts.set(key, recent);
    return true;
  }

  reset(key?: string): void {
    if (key) {
      this.attempts.delete(key);
    } else {
      this.attempts.clear();
    }
  }

  private cleanup(now: number): void {
    if (now - this.lastCleanup < Math.max(this.windowMs, 30_000)) return;
    this.lastCleanup = now;
    const cutoff = now - this.windowMs;
    for (const [k, timestamps] of this.attempts.entries()) {
      const active = timestamps.filter((t) => t > cutoff);
      if (active.length === 0) {
        this.attempts.delete(k);
      } else {
        this.attempts.set(k, active);
      }
    }
  }
}

/**
 * Limitador global para conexiones WebSocket entrantes (por IP).
 * 60 conexiones por minuto por IP previene bucles de reconexión y flood.
 */
export const connectionLimiter = new SocketRateLimiter(60_000, 60);

export function getClientIp(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return socket.handshake.address || (socket.conn as { remoteAddress?: string })?.remoteAddress || '';
}

/**
 * Middleware para rate limiting de conexiones Socket.IO.
 */
export function rateLimitSocketConnection(socket: Socket, next: (err?: Error) => void) {
  const ip = getClientIp(socket);
  if (ip && !connectionLimiter.isAllowed(ip)) {
    return next(new Error('Demasiadas conexiones, intenta más tarde'));
  }
  next();
}
