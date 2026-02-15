import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateJWT, AuthRequest } from '../middleware/auth.js';
import { challengeService } from '../services/challenge.service.js';
import { Category } from '@prisma/client';

const router = Router();

const normalizeCategory = (value: unknown) => {
  if (typeof value !== 'string') return value;
  return value.toUpperCase();
};

export const createChallengeSchema = z.object({
  categories: z.array(z.preprocess(normalizeCategory, z.nativeEnum(Category))).min(1),
  maxPlayers: z.coerce.number().int().min(2).max(8),
  answerTimeSeconds: z.coerce.number().int().refine((v) => [10, 20, 30].includes(v)),
});

const submitResultSchema = z.object({
  score: z.number().min(0),
  correctCount: z.number().min(0),
});

router.post('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const data = createChallengeSchema.parse(req.body);

    const challenge = await challengeService.createChallenge(
      req.user!.userId,
      data.categories as Category[],
      data.maxPlayers,
      data.answerTimeSeconds
    );

    res.status(201).json({ message: 'Desafío creado exitosamente', challenge });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.errors });
    }
    res.status(400).json({ error: error.message || 'Error al crear el desafío' });
  }
});

router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const type = (req.query.type as 'mine' | 'joinable' | 'all') || 'all';
    const challenges = await challengeService.getChallenges(req.user!.userId, type);
    res.json({ challenges });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error al obtener desafíos' });
  }
});

router.get('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const challenge = await challengeService.getChallenge(req.params.id, req.user!.userId);
    res.json({ challenge });
  } catch (error: any) {
    res.status(404).json({ error: error.message || 'Desafío no encontrado' });
  }
});

router.get('/:id/questions', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const data = await challengeService.getChallengeQuestions(req.params.id, req.user!.userId);
    res.json(data);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al obtener preguntas' });
  }
});

router.post('/:id/join', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const challenge = await challengeService.joinChallenge(req.params.id, req.user!.userId);
    res.json({ message: 'Te uniste al desafío', challenge });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al unirse al desafío' });
  }
});

router.post('/:id/accept', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const challenge = await challengeService.joinChallenge(req.params.id, req.user!.userId);
    res.json({ message: 'Desafío aceptado', challenge });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Error al aceptar el desafío' });
  }
});

router.post('/:id/submit', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const data = submitResultSchema.parse(req.body);
    const challenge = await challengeService.submitChallengeResult(
      req.params.id,
      req.user!.userId,
      data.score,
      data.correctCount
    );

    res.json({ message: 'Resultado guardado', challenge });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.errors });
    }
    res.status(400).json({ error: error.message || 'Error al guardar resultado' });
  }
});

export default router;
