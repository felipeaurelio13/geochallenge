import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import {
  DuelFinalizationPayload,
  persistDuelFinalization,
} from './duelPersistence.service.js';
import {
  SurvivalFinalizationPayload,
  persistSurvivalFinalization,
} from './survivalPersistence.service.js';

export type GameType = 'DUEL' | 'SURVIVAL';
export type FinalizationStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

const MAX_ERROR_LENGTH = 1000;
const RECOVERY_BATCH_SIZE = 50;

export function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.length > MAX_ERROR_LENGTH ? msg.substring(0, MAX_ERROR_LENGTH) : msg;
}

export interface PendingFinalizationRecord {
  id: string;
  runId: string;
  gameType: GameType;
  payload: unknown;
  status: FinalizationStatus;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export async function upsertPendingFinalization(
  runId: string,
  gameType: GameType,
  payload: unknown,
  db: Pick<PrismaClient, 'pendingGameFinalization'> = prisma
): Promise<PendingFinalizationRecord> {
  const record = await db.pendingGameFinalization.upsert({
    where: { runId },
    create: {
      runId,
      gameType,
      payload: payload as Prisma.InputJsonValue,
      status: 'PENDING',
      attempts: 0,
    },
    update: {},
  });

  return {
    id: record.id,
    runId: record.runId,
    gameType: record.gameType as GameType,
    payload: record.payload,
    status: record.status as FinalizationStatus,
    attempts: record.attempts,
    lastError: record.lastError,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    completedAt: record.completedAt,
  };
}

export async function markFinalizationCompleted(
  runId: string,
  db: Pick<PrismaClient, 'pendingGameFinalization'> = prisma
): Promise<void> {
  await db.pendingGameFinalization.update({
    where: { runId },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });
}

export async function failFinalization(
  runId: string,
  error: unknown,
  db: Pick<PrismaClient, 'pendingGameFinalization'> = prisma
): Promise<void> {
  await db.pendingGameFinalization.update({
    where: { runId },
    data: {
      status: 'PENDING',
      attempts: { increment: 1 },
      lastError: sanitizeError(error),
    },
  });
}

export async function recoverPendingGameFinalizations(
  limit: number = RECOVERY_BATCH_SIZE,
  db: Pick<PrismaClient, '$transaction' | 'pendingGameFinalization'> = prisma
): Promise<{ recovered: number; failed: number }> {
  const pendings = await prisma.pendingGameFinalization.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let recovered = 0;
  let failed = 0;

  for (const pending of pendings) {
    try {
      const payload = pending.payload as Record<string, unknown>;
      if (pending.gameType === 'DUEL') {
        await persistDuelFinalization(payload as unknown as DuelFinalizationPayload, db);
      } else if (pending.gameType === 'SURVIVAL') {
        await persistSurvivalFinalization(payload as unknown as SurvivalFinalizationPayload, db);
      } else {
        throw new Error(`Unknown gameType: ${pending.gameType}`);
      }

      await markFinalizationCompleted(pending.runId);
      recovered++;
    } catch (err) {
      await failFinalization(pending.runId, err);
      failed++;
      console.error(
        `[pendingFinalization] recovery failed for runId=${pending.runId} (attempt ${pending.attempts + 1}):`,
        sanitizeError(err)
      );
    }
  }

  return { recovered, failed };
}
