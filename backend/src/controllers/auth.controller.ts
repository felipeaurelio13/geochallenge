import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { generateToken, authenticateJWT, AuthRequest } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { normalizeEmail, normalizeUsername } from '../utils/authNormalization.js';
import { AppError } from '../utils/appError.js';
import { respondWithError } from '../utils/respondWithError.js';
import { mapZodIssuesToFields } from '../utils/zodIssueMapper.js';
import { sendPasswordResetEmail } from '../services/email.service.js';

const router = Router();

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutos

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// Schemas de validación
const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
    .max(20, 'El nombre de usuario no puede exceder 20 caracteres')
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guiones bajos'),
  email: z.string().email('Email inválido'),
  password: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(100, 'Contraseña demasiado larga'),
  preferredLanguage: z.enum(['es', 'en']).optional().default('es'),
});

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  newPassword: z
    .string()
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .max(100, 'Contraseña demasiado larga'),
});

/**
 * POST /api/auth/register
 * Registrar nuevo usuario
 */
router.post('/register', authLimiter, async (req: Request, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        code: 'VALIDATION_FAILED',
        params: { fields: mapZodIssuesToFields(validation.error.errors) },
        details: validation.error.errors,
      });
      return;
    }

    const normalizedUsername = normalizeUsername(validation.data.username);
    const normalizedEmail = normalizeEmail(validation.data.email);
    const { password, preferredLanguage } = validation.data;

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: { equals: normalizedEmail, mode: 'insensitive' } }, { username: normalizedUsername }],
      },
    });

    if (existingUser) {
      const emailTaken = existingUser.email.toLowerCase() === normalizedEmail;
      if (emailTaken) {
        throw new AppError('AUTH_EMAIL_TAKEN', 400, 'El email ya está registrado');
      }
      throw new AppError('AUTH_USERNAME_TAKEN', 400, 'El nombre de usuario ya está registrado');
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
        preferredLanguage,
      },
      select: {
        id: true,
        username: true,
        email: true,
        preferredLanguage: true,
        highScore: true,
        gamesPlayed: true,
        createdAt: true,
      },
    });

    // Generar token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user,
      token,
    });
  } catch (error) {
    respondWithError(res, error);
  }
});

/**
 * POST /api/auth/login
 * Iniciar sesión
 */
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        code: 'VALIDATION_FAILED',
        params: { fields: mapZodIssuesToFields(validation.error.errors) },
        details: validation.error.errors,
      });
      return;
    }

    const normalizedEmail = normalizeEmail(validation.data.email);
    const { password } = validation.data;

    // Buscar usuario (email case-insensitive + trim)
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
      },
    });

    if (!user) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 401, 'Credenciales inválidas');
    }

    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 401, 'Credenciales inválidas');
    }

    // Generar token
    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    res.json({
      message: 'Inicio de sesión exitoso',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        preferredLanguage: user.preferredLanguage,
        highScore: user.highScore,
        gamesPlayed: user.gamesPlayed,
        wins: user.wins,
        losses: user.losses,
      },
      token,
    });
  } catch (error) {
    respondWithError(res, error);
  }
});

/**
 * POST /api/auth/forgot-password
 * Genera un token de recuperación y envía un email si el usuario existe.
 * Siempre responde 200 con un mensaje genérico (previene user enumeration).
 */
router.post('/forgot-password', authLimiter, async (req: Request, res: Response) => {
  const GENERIC_MESSAGE = 'Si el email está registrado, vas a recibir un correo con instrucciones para recuperar tu contraseña.';

  try {
    const validation = forgotPasswordSchema.safeParse(req.body);

    if (!validation.success) {
      // No hacemos 400 acá tampoco para no diferenciar "email mal formado" de
      // "email válido pero inexistente" — ambos casos responden el genérico.
      res.json({ message: GENERIC_MESSAGE });
      return;
    }

    const normalizedEmail = normalizeEmail(validation.data.email);

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      select: { id: true, email: true, preferredLanguage: true },
    });

    if (user) {
      try {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
          },
        });

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
        const language = user.preferredLanguage === 'en' ? 'en' : 'es';

        await sendPasswordResetEmail(user.email, resetUrl, language);
      } catch (err) {
        // Nunca debe romper la respuesta genérica: local dev sin RESEND_API_KEY
        // o fallas de infra no deben impedir el flujo (ni filtrar si el email existe).
        console.warn('[auth] forgot-password: fallo no bloqueante generando/enviando el reset:', err);
      }
    }

    res.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    respondWithError(res, error);
  }
});

/**
 * POST /api/auth/reset-password
 * Valida el token de recuperación y actualiza la contraseña.
 */
router.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
  try {
    const validation = resetPasswordSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        code: 'VALIDATION_FAILED',
        params: { fields: mapZodIssuesToFields(validation.error.errors) },
        details: validation.error.errors,
      });
      return;
    }

    const { token, newPassword } = validation.data;
    const tokenHash = hashToken(token);

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: { tokenHash },
    });

    if (!resetToken) {
      throw new AppError('AUTH_RESET_TOKEN_INVALID', 400, 'El enlace de recuperación no es válido');
    }

    const isExpired = resetToken.expiresAt.getTime() < Date.now();
    if (resetToken.usedAt || isExpired) {
      throw new AppError('AUTH_RESET_TOKEN_EXPIRED', 400, 'El enlace de recuperación expiró o ya fue usado');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });

      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: now },
      });

      // Invalidar cualquier otro token vigente del mismo usuario.
      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          id: { not: resetToken.id },
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
    });

    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    respondWithError(res, error);
  }
});

/**
 * GET /api/auth/me
 * Obtener usuario actual
 */
router.get('/me', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        username: true,
        email: true,
        preferredLanguage: true,
        highScore: true,
        gamesPlayed: true,
        wins: true,
        losses: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'Usuario no encontrado' });
      return;
    }

    res.json({ user });
  } catch (error) {
    respondWithError(res, error);
  }
});

/**
 * PUT /api/auth/profile
 * Actualizar perfil
 */
router.put('/profile', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const updateSchema = z.object({
      username: z
        .string()
        .min(3)
        .max(20)
        .regex(/^[a-zA-Z0-9_]+$/)
        .optional(),
      preferredLanguage: z.enum(['es', 'en']).optional(),
    });

    const validation = updateSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Datos inválidos',
        code: 'VALIDATION_FAILED',
        params: { fields: mapZodIssuesToFields(validation.error.errors) },
        details: validation.error.errors,
      });
      return;
    }

    const { username, preferredLanguage } = validation.data;

    // Verificar username único si se está cambiando
    if (username) {
      const existing = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id: req.user!.userId },
        },
      });

      if (existing) {
        throw new AppError('AUTH_USERNAME_TAKEN', 400, 'El nombre de usuario ya está en uso');
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(username && { username }),
        ...(preferredLanguage && { preferredLanguage }),
      },
      select: {
        id: true,
        username: true,
        email: true,
        preferredLanguage: true,
        highScore: true,
        gamesPlayed: true,
        wins: true,
        losses: true,
      },
    });

    res.json({ user });
  } catch (error) {
    respondWithError(res, error);
  }
});

export default router;
