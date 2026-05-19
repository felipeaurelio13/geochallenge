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
export const globalLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES_IN_MS,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta de nuevo más tarde' },
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
      retryAfterSeconds,
    });
  },
});
