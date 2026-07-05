import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticateJWT, AuthRequest } from '../middleware/auth.js';
import { challengeService } from '../services/challenge.service.js';
import { Category } from '@prisma/client';
import { QuestionFilters } from '../services/game.service.js';
import { respondWithError } from '../utils/respondWithError.js';
import { mapZodIssuesToFields } from '../utils/zodIssueMapper.js';

const router = Router();

const normalizeCategory = (value: unknown) => {
  if (typeof value !== 'string') return value;
  return value.toUpperCase();
};

export const createChallengeSchema = z.object({
  categories: z.array(z.preprocess(normalizeCategory, z.nativeEnum(Category))).min(1),
  maxPlayers: z.coerce.number().int().min(2).max(8),
  answerTimeSeconds: z.coerce.number().int().refine((v) => [10, 20, 30].includes(v)),
  filters: z.object({
    continent: z.string().optional(),
    isInsular: z.boolean().optional(),
    isLandlocked: z.boolean().optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  }).optional(),
});

// El cliente manda sus respuestas, NUNCA el puntaje: el servidor las valida
// contra la DB y calcula el score (ver utils/answerEvaluation.ts).
export const submitResultSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string().min(1).max(64),
        answer: z.string().max(200).optional(),
        mapAnswer: z
          .object({
            lat: z.number().min(-90).max(90),
            lng: z.number().min(-180).max(180),
          })
          .optional(),
        timeRemaining: z.number().min(0).max(300),
      })
    )
    .max(20),
});

router.post('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const data = createChallengeSchema.parse(req.body);

    const challenge = await challengeService.createChallenge(
      req.user!.userId,
      data.categories as Category[],
      data.maxPlayers,
      data.answerTimeSeconds,
      data.filters as QuestionFilters | undefined
    );

    res.status(201).json({ message: 'Desafío creado exitosamente', challenge });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Datos inválidos',
        code: 'VALIDATION_FAILED',
        params: { fields: mapZodIssuesToFields(error.errors) },
        details: error.errors,
      });
    }
    respondWithError(res, error, 400);
  }
});

router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const type = (req.query.type as 'mine' | 'joinable' | 'all') || 'all';
    const challenges = await challengeService.getChallenges(req.user!.userId, type);
    res.json({ challenges });
  } catch (error) {
    respondWithError(res, error);
  }
});

router.get('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const challenge = await challengeService.getChallenge(req.params.id, req.user!.userId);
    res.json({ challenge });
  } catch (error) {
    respondWithError(res, error, 404);
  }
});

router.get('/:id/questions', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const data = await challengeService.getChallengeQuestions(req.params.id, req.user!.userId);
    res.json(data);
  } catch (error) {
    respondWithError(res, error, 400);
  }
});

router.post('/:id/join', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const challenge = await challengeService.joinChallenge(req.params.id, req.user!.userId);
    res.json({ message: 'Te uniste al desafío', challenge });
  } catch (error) {
    respondWithError(res, error, 400);
  }
});

router.post('/:id/accept', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const challenge = await challengeService.joinChallenge(req.params.id, req.user!.userId);
    res.json({ message: 'Desafío aceptado', challenge });
  } catch (error) {
    respondWithError(res, error, 400);
  }
});

router.post('/:id/submit', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    // Clientes con la versión anterior cacheada (PWA) mandan {score, correctCount}.
    if (!req.body?.answers && typeof req.body?.score === 'number') {
      return res.status(400).json({
        error: 'Tu versión de la app está desactualizada. Recarga la página e intenta de nuevo.',
      });
    }

    const data = submitResultSchema.parse(req.body);
    const { challenge, result } = await challengeService.submitChallengeResult(
      req.params.id,
      req.user!.userId,
      data.answers
    );

    res.json({ message: 'Resultado guardado', challenge, result });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Datos inválidos',
        code: 'VALIDATION_FAILED',
        params: { fields: mapZodIssuesToFields(error.errors) },
        details: error.errors,
      });
    }
    respondWithError(res, error, 400);
  }
});

export default router;
