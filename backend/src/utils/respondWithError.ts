import { Response } from 'express';
import { AppError } from './appError.js';

/**
 * Genera un id corto (8 hex chars) para correlacionar el error loggeado en el
 * servidor con lo que ve el usuario, sin exponer el stack trace al cliente.
 */
function generateRequestId(): string {
  return Math.random().toString(16).slice(2, 10).padEnd(8, '0');
}

interface ErrorPayload {
  error: string;
  code: string;
  params?: Record<string, unknown>;
}

function buildErrorPayload(err: unknown): { payload: ErrorPayload; status: number } {
  if (err instanceof AppError) {
    return {
      status: err.status,
      payload: {
        error: err.message,
        code: err.code,
        ...(err.params ? { params: err.params } : {}),
      },
    };
  }

  const requestId = generateRequestId();
  console.error(`[${requestId}]`, err);
  return {
    status: 500,
    payload: {
      error: 'Error interno del servidor',
      code: 'INTERNAL',
      params: { requestId },
    },
  };
}

/**
 * Maneja errores de forma consistente en catch blocks HTTP:
 * - Si es un AppError, responde con su status/code/params y el mensaje
 *   en español (fallback para frontends que aún no reconocen `code`).
 * - Si es cualquier otro error, no filtra el detalle: loggea con un
 *   requestId y responde un 500 genérico + ese requestId para soporte.
 */
export function respondWithError(res: Response, err: unknown, fallbackStatus = 500): void {
  const { payload, status } = buildErrorPayload(err);
  const isAppError = err instanceof AppError;
  res.status(isAppError ? status : fallbackStatus).json(payload);
}

/**
 * Cualquier emisor de Socket.IO: un Socket individual, el Server, o un
 * BroadcastOperator devuelto por `io.to(room)` — todos exponen `emit`.
 */
interface SocketEmitter {
  emit(event: string, ...args: unknown[]): unknown;
}

/**
 * Equivalente de respondWithError para eventos de socket: no hay status HTTP,
 * así que se emite `{ message, code, params }` en el evento indicado
 * (p.ej. 'duel:error', 'survival:error').
 */
export function emitSocketError(target: SocketEmitter, event: string, err: unknown): void {
  const { payload } = buildErrorPayload(err);
  target.emit(event, {
    message: payload.error,
    code: payload.code,
    ...(payload.params ? { params: payload.params } : {}),
  });
}
