import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { prisma } from '../config/database.js';

export interface JwtPayload {
  userId: string;
  username: string;
  email: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

async function resolveBypassUser(req: AuthRequest): Promise<JwtPayload | null> {
  if (!config.testAuthBypass.enabled || !config.testAuthBypass.secret) {
    return null;
  }

  const bypassHeader = req.headers['x-test-auth-bypass'];
  if (bypassHeader !== config.testAuthBypass.secret) {
    return null;
  }

  const email = config.testAuthBypass.defaultEmail;
  const username = email.split('@')[0].slice(0, 20);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      username,
      passwordHash: 'test-auth-bypass-no-login',
      preferredLanguage: 'es',
    },
    select: {
      id: true,
      email: true,
      username: true,
    },
  });

  return {
    userId: user.id,
    email: user.email,
    username: user.username,
  };
}

/**
 * Middleware para verificar JWT token
 */
export async function authenticateJWT(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const bypassUser = await resolveBypassUser(req);
  if (bypassUser) {
    req.user = bypassUser;
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de autenticación requerido' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expirado' });
      return;
    }
    res.status(403).json({ error: 'Token inválido' });
  }
}

/**
 * Middleware opcional - no falla si no hay token
 */
export async function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const bypassUser = await resolveBypassUser(req);
  if (bypassUser) {
    req.user = bypassUser;
    next();
    return;
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;
  } catch {
    // Token inválido, pero continuamos sin usuario
  }

  next();
}

/**
 * Genera un JWT token
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  } as jwt.SignOptions);
}
