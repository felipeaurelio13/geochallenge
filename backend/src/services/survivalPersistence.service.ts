import { Category, GameMode, GameVariant, Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/database.js';
import { AnswerResult, saveGameResult } from './game.service.js';

export interface SurvivalFinalizationPlayer {
  userId: string;
  answers: AnswerResult[];
  finalRank: number;
  eliminatedRound: number | null;
  finalScore: number;
  correctCount: number;
  livesEarned: number;
}

export interface SurvivalFinalizationPayload {
  matchId: string;
  category: Category | null;
  totalRounds: number;
  peakPlayers: number;
  players: SurvivalFinalizationPlayer[];
}

function survivalRunId(matchId: string, userId: string): string {
  return `survival:${matchId}:${userId}`;
}

export async function persistSurvivalFinalization(
  payload: SurvivalFinalizationPayload,
  db: Pick<PrismaClient, '$transaction'> = prisma
): Promise<void> {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.survivalMatch.upsert({
      where: { id: payload.matchId },
      create: {
        id: payload.matchId,
        category: payload.category ?? null,
        totalRounds: payload.totalRounds,
        peakPlayers: payload.peakPlayers,
      },
      update: {},
    });

    for (const p of payload.players) {
      await tx.survivalParticipant.upsert({
        where: { matchId_userId: { matchId: payload.matchId, userId: p.userId } },
        create: {
          matchId: payload.matchId,
          userId: p.userId,
          finalRank: p.finalRank,
          eliminatedRound: p.eliminatedRound,
          finalScore: p.finalScore,
          correctCount: p.correctCount,
          livesEarned: p.livesEarned,
        },
        update: {},
      });

      await saveGameResult(
        p.userId,
        p.answers,
        GameVariant.CLASSIC,
        GameMode.SURVIVAL,
        payload.category ?? undefined,
        tx,
        survivalRunId(payload.matchId, p.userId)
      );
    }
  });
}
