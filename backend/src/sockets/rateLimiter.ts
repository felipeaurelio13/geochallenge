import { AppError } from '../utils/appError.js';
import { emitSocketError } from '../utils/respondWithError.js';

export interface SocketEmitter {
  emit(event: string, ...args: unknown[]): unknown;
}

export interface SocketRateLimiterOptions {
  /** Capacidad máxima del bucket de ráfaga (ráfaga permitida de eventos inmediatos). Default: 30 */
  capacity?: number;
  /** Tasa de rellenado en tokens por segundo. Default: 10 */
  refillRate?: number;
}

/**
 * Middleware para Socket.IO que implementa rate limiting por token bucket a nivel
 * de eventos por socket individual (OWASP API4:2023: Unrestricted Resource Consumption).
 *
 * Evita que clientes autenticados inunden el event loop con emisiones de alta frecuencia
 * (ej. spam de respuestas o colas de duelo/survival), protegiendo Redis y PostgreSQL.
 */
export function createSocketEventRateLimiter(
  socket: SocketEmitter,
  options: SocketRateLimiterOptions = {}
) {
  const capacity = options.capacity ?? 30;
  const refillRate = options.refillRate ?? 10;
  let tokens = capacity;
  let lastRefill = Date.now();

  return (packet: [string, ...unknown[]], next: (err?: Error) => void) => {
    const eventName = packet[0];
    const now = Date.now();
    const elapsedSeconds = Math.max(0, (now - lastRefill) / 1000);
    tokens = Math.min(capacity, tokens + elapsedSeconds * refillRate);
    lastRefill = now;

    if (tokens < 1) {
      const errorEvent = typeof eventName === 'string' && eventName.startsWith('survival:')
        ? 'survival:error'
        : typeof eventName === 'string' && eventName.startsWith('duel:')
        ? 'duel:error'
        : 'error';

      const retryAfterSeconds = Math.max(1, Math.ceil((1 - tokens) / refillRate));

      emitSocketError(
        socket,
        errorEvent,
        new AppError(
          'RATE_LIMITED',
          429,
          'Demasiadas solicitudes en tiempo real, intenta de nuevo más tarde',
          { retryAfterSeconds }
        )
      );

      return next(new Error('SOCKET_RATE_LIMIT_EXCEEDED'));
    }

    tokens -= 1;
    next();
  };
}
