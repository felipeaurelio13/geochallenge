import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { generateToken, authenticateJWT, AuthRequest } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();

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
        details: validation.error.errors,
      });
      return;
    }

    const { username, email, password, preferredLanguage } = validation.data;

    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'nombre de usuario';
      res.status(400).json({ error: `El ${field} ya está registrado` });
      return;
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 12);

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        username,
        email,
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
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
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
        details: validation.error.errors,
      });
      return;
    }

    const { email, password } = validation.data;

    // Buscar usuario
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
    }

    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.passwordHash);

    if (!validPassword) {
      res.status(401).json({ error: 'Credenciales inválidas' });
      return;
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
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
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
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
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
        res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
        return;
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
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
