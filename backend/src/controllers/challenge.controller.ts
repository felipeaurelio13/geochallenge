import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticateJWT, AuthRequest } from '../middleware/auth.js';
import { challengeService } from '../services/challenge.service.js';
import { Category } from '@prisma/client';

const router = Router();

// Validation schemas
const createChallengeSchema = z.object({
  challengedUsername: z.string().min(1),
  category: z.enum(['MAP', 'FLAG', 'CAPITAL', 'SILHOUETTE', 'MIXED']).optional(),
});

const submitResultSchema = z.object({
  score: z.number().min(0),
  correctCount: z.number().min(0),
});

/**
 * POST /api/challenges - Create a new challenge
 */
router.post('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const data = createChallengeSchema.parse(req.body);

    const challenge = await challengeService.createChallenge(
      req.user!.userId,
      data.challengedUsername,
      data.category as Category | undefined
    );

    res.status(201).json({
      message: 'Desafio creado exitosamente',
      challenge,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos invalidos', details: error.errors });
    }
    res.status(400).json({ error: error.message || 'Error al crear el desafio' });
  }
});

/**
 * GET /api/challenges - Get user's challenges
 */
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const type = (req.query.type as 'sent' | 'received' | 'all') || 'all';
    const challenges = await challengeService.getChallenges(req.user!.userId, type);

    res.json({ challenges });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error al obtener desafios' });
  }
});

/**
 * GET /api/challenges/:id - Get specific challenge
 */
router.get('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const challenge = await challengeService.getChallenge(req.params.id, req.user!.userId);
    res.json({ challenge });
  } catch (error: any) {
    res.status(404).json({ error: error.message || 'Desafio no encontrado' });
  }
});

/**
 * GET /api/challenges/:id/questions - Get questions for a challenge
 */
router.get('/:id/questions', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const data = await challengeService.getChallengeQuestions(req.params.id, req.user!.userId);
    res.json(data);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al obtener preguntas' });
  }
});

/**
 * POST /api/challenges/:id/accept - Accept a challenge
 */
router.post('/:id/accept', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const challenge = await challengeService.acceptChallenge(req.params.id, req.user!.userId);

    res.json({
      message: 'Desafio aceptado',
      challenge,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al aceptar el desafio' });
  }
});

/**
 * POST /api/challenges/:id/decline - Decline a challenge
 */
router.post('/:id/decline', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const challenge = await challengeService.declineChallenge(req.params.id, req.user!.userId);

    res.json({
      message: 'Desafio rechazado',
      challenge,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al rechazar el desafio' });
  }
});

/**
 * POST /api/challenges/:id/submit - Submit challenge result
 */
router.post('/:id/submit', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const data = submitResultSchema.parse(req.body);

    const challenge = await challengeService.submitChallengeResult(
      req.params.id,
      req.user!.userId,
      data.score,
      data.correctCount
    );

    res.json({
      message: 'Resultado guardado',
      challenge,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos invalidos', details: error.errors });
    }
    res.status(400).json({ error: error.message || 'Error al guardar resultado' });
  }
});

export default router;
