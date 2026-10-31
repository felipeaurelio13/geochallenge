import type { RequestHandler } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';

const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;

export function calculateRetryAfterSeconds(resetTime?: Date, now = Date.now()): number {
  if (!resetTime) {
    return 60;
  }

  const remainingSeconds = Math.ceil((resetTime.getTime() - now) / 1000);
  return Math.max(1, remainingSeconds);
}

// 100 req / 15min era ~7 rpm: una sesión normal (login + menu probing +
// 2 partidas de racha) consumía todo el cupo y dejaba al usuario sin poder
// jugar más, con 429 en /auth/me cascadeando a logout (ver AuthContext).
// 1000 req / 15min ≈ 66 rpm permite gameplay activo sin abrir la puerta a
// abuso real (que igual se atajaría con authLimiter en /api/auth).
export const globalErrorMessage = {
  error: 'Demasiadas solicitudes, intenta de nuevo más tarde',
};

export const globalLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_IN_MS,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: globalErrorMessage,
  handler: (req, res, _next, options) => {
    const requestWithRateLimit = req as typeof req & { rateLimit?: { resetTime?: Date } };
    const retryAfterSeconds = calculateRetryAfterSeconds(requestWithRateLimit.rateLimit?.resetTime);

    res.status(options.statusCode).json({
      ...globalErrorMessage,
      code: 'RATE_LIMITED',
      params: { retryAfterSeconds },
      retryAfterSeconds,
    });
  },
});

export const authErrorMessage = {
  error: 'Demasiados intentos de autenticación. Espera un momento e intenta nuevamente.',
};

export const authLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: FIFTEEN_MINUTES_IN_MS,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: authErrorMessage,
  handler: (req, res, _next, options) => {
    const requestWithRateLimit = req as typeof req & { rateLimit?: { resetTime?: Date } };
    const retryAfterSeconds = calculateRetryAfterSeconds(requestWithRateLimit.rateLimit?.resetTime);

    res.status(options.statusCode).json({
      ...authErrorMessage,
      code: 'RATE_LIMITED',
      params: { retryAfterSeconds },
      retryAfterSeconds,
    });
  },
});

// ---------------------------------------------------------------------------
// Socket.IO Handshake Rate Limiter (OWASP API4:2023 - Resource Consumption)
// ---------------------------------------------------------------------------
export const SOCKET_HANDSHAKE_WINDOW_MS = 60 * 1000; // 1 minute window
export const SOCKET_HANDSHAKE_MAX = 60; // 60 handshakes / min per IP

interface RateRecord {
  count: number;
  resetTime: number;
}

const socketIpStore = new Map<string, RateRecord>();

export function extractClientIp(req: {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

export function checkSocketHandshakeRate(
  ip: string,
  now = Date.now(),
  max = SOCKET_HANDSHAKE_MAX,
  windowMs = SOCKET_HANDSHAKE_WINDOW_MS
): { allowed: boolean; retryAfterSeconds: number } {
  // Prune map if it grows large to avoid unbounded memory leaks
  if (socketIpStore.size > 5000) {
    for (const [key, value] of socketIpStore.entries()) {
      if (now > value.resetTime) {
        socketIpStore.delete(key);
      }
    }
  }

  const record = socketIpStore.get(ip);
  if (!record || now > record.resetTime) {
    socketIpStore.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (record.count >= max) {
    const remainingSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return { allowed: false, retryAfterSeconds: remainingSeconds };
  }

  record.count++;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetSocketHandshakeStore(): void {
  socketIpStore.clear();
}

/**
 * Socket.IO allowRequest callback for Engine.IO handshake throttling.
 */
export function socketHandshakeAllowRequest(
  req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } },
  callback: (err: string | null | undefined, success: boolean) => void
): void {
  const ip = extractClientIp(req);
  const { allowed, retryAfterSeconds } = checkSocketHandshakeRate(ip);
  if (!allowed) {
    return callback(`Demasiadas solicitudes de conexión: reintenta en ${retryAfterSeconds}s`, false);
  }
  callback(null, true);
}

/**
 * Express middleware for /socket.io HTTP polling/handshake routes.
 */
export const socketHandshakeExpressLimiter: RequestHandler = (req, res, next) => {
  const ip = (req as { ip?: string }).ip || extractClientIp(req);
  const { allowed, retryAfterSeconds } = checkSocketHandshakeRate(ip);
  if (!allowed) {
    res.status(429).json({
      error: 'Demasiadas solicitudes de conexión, intenta de nuevo más tarde',
      code: 'RATE_LIMITED',
      params: { retryAfterSeconds },
      retryAfterSeconds,
    });
    return;
  }
  next();
};
