import { z } from 'zod';
import { Category } from '@prisma/client';
import type { Socket } from 'socket.io';
import { AppError } from '../utils/appError.js';
import { emitSocketError } from '../utils/respondWithError.js';

// ─── Schemas de payloads de socket ───────────────────────────────────────────
// Los eventos de socket llegan sin ninguna garantía de forma: validar antes de
// usar evita NaN en el scoring (haversine con lat/lng string) y consultas
// Prisma con filtros inválidos.

const MAX_ID_LENGTH = 200;
const MAX_ANSWER_LENGTH = 200;

export const socketCategorySchema = z.nativeEnum(Category);

// Mismo contrato que `questionFiltersSchema` de game.controller.ts (que no está
// exportado y vive en un controller Express; importarlo arrastraría todo el
// router al layer de sockets). Se mantiene en sincronía manualmente.
const booleanLike = z.preprocess((v) => v === 'true' || v === true, z.boolean());

export const socketQuestionFiltersSchema = z.object({
  continent: z.string().max(100).optional(),
  isInsular: booleanLike.optional(),
  isLandlocked: booleanLike.optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
});

export const socketCoordinatesSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});

const nullToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === null ? undefined : v), schema.optional());

export const duelQueueSchema = z
  .object({
    category: nullToUndefined(socketCategorySchema),
    filters: nullToUndefined(socketQuestionFiltersSchema),
    mode: nullToUndefined(z.enum(['classic', 'geo-challenge'])),
    rated: nullToUndefined(z.boolean()),
  })
  .optional();

export const duelAnswerSchema = z.object({
  questionId: z.string().min(1).max(MAX_ID_LENGTH),
  answer: z.string().max(MAX_ANSWER_LENGTH),
  // El cliente lo envía pero el servidor nunca lo usa para puntuar.
  timeRemaining: nullToUndefined(z.number().finite()),
  mechanicUsage: nullToUndefined(z.object({}).passthrough()),
  coordinates: nullToUndefined(socketCoordinatesSchema),
});

export const survivalQueueSchema = z
  .object({
    category: nullToUndefined(socketCategorySchema),
  })
  .optional();

export const survivalAnswerSchema = z.object({
  questionId: z.string().min(1).max(MAX_ID_LENGTH),
  answer: z.string().max(MAX_ANSWER_LENGTH),
  timeRemaining: nullToUndefined(z.number().finite()),
  coordinates: nullToUndefined(socketCoordinatesSchema),
});

export type DuelQueuePayload = z.infer<typeof duelQueueSchema>;
export type DuelAnswerPayload = z.infer<typeof duelAnswerSchema>;
export type SurvivalQueuePayload = z.infer<typeof survivalQueueSchema>;
export type SurvivalAnswerPayload = z.infer<typeof survivalAnswerSchema>;

/**
 * Valida el payload de un evento. Si es inválido emite el error de socket
 * estándar (`VALIDATION_FAILED`) en `errorEvent` y devuelve `null`.
 */
export function parseSocketPayload<T extends z.ZodTypeAny>(
  socket: Pick<Socket, 'emit'>,
  errorEvent: string,
  schema: T,
  payload: unknown
): z.infer<T> | null {
  const result = schema.safeParse(payload);
  if (result.success) return result.data;

  emitSocketError(
    socket,
    errorEvent,
    new AppError('VALIDATION_FAILED', 400, 'Datos inválidos', {
      issues: result.error.issues.slice(0, 5).map((i) => i.path.join('.') || '(root)'),
    })
  );
  return null;
}

// ─── safeHandler ─────────────────────────────────────────────────────────────

/**
 * Convierte cualquier error en el AppError que se emitirá al cliente: los
 * AppError pasan tal cual; el resto se oculta tras un código genérico.
 */
export function toSocketAppError(err: unknown, genericCode: string, genericMessage: string): AppError {
  return err instanceof AppError ? err : new AppError(genericCode, 500, genericMessage);
}

/**
 * Socket.IO no atrapa los rechazos de listeners async, y en Node >= 15 un
 * unhandledRejection mata el proceso. Este wrapper garantiza que ningún
 * listener rechace: loggea el error y notifica al cliente con la forma de
 * error de socket existente.
 */
export function safeHandler<A extends unknown[]>(
  socket: Pick<Socket, 'emit'>,
  errorEvent: string,
  fn: (...args: A) => unknown,
  options: { genericCode: string; genericMessage?: string; label?: string } = {
    genericCode: 'INTERNAL',
  }
): (...args: A) => Promise<void> {
  const { genericCode, genericMessage = 'Error procesando la solicitud', label = errorEvent } = options;
  return async (...args: A) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`[socket] error en listener (${label}):`, err);
      try {
        emitSocketError(socket, errorEvent, toSocketAppError(err, genericCode, genericMessage));
      } catch (emitErr) {
        console.error(`[socket] no se pudo notificar el error (${label}):`, emitErr);
      }
    }
  };
}
