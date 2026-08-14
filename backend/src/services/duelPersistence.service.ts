import {
  Category,
  CompetitiveLadder,
  DuelFinishReason,
  GameMode,
  GameVariant,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { prisma } from '../config/database.js';
import { AnswerResult, saveGameResult } from './game.service.js';
import {
  AppliedRatingChange,
  RATING_VERSION,
  applyCompetitiveRatingForDuel,
  getCompetitiveTier,
} from './competitiveRating.service.js';

export type PersistDuelFinishReason = 'completed' | 'opponent_disconnected' | 'cancelled';

export interface PersistableDuelPlayer {
  userId: string;
  username: string;
  answers: AnswerResult[];
  score: number;
}

export interface PersistableDuel {
  id: string;
  players: [PersistableDuelPlayer, PersistableDuelPlayer];
  category?: Category;
  mode: 'classic' | 'geo-challenge';
  rated: boolean;
  ladder?: CompetitiveLadder;
  startedAt?: Date;
}

export interface PersistDuelResult {
  persisted: boolean;
  duelMatch: { id: string };
  ratingEligible: boolean;
  ratingChanges: AppliedRatingChange[];
}

function finishReasonForPrisma(reason: PersistDuelFinishReason): DuelFinishReason {
  if (reason === 'completed') return DuelFinishReason.COMPLETED;
  if (reason === 'opponent_disconnected') return DuelFinishReason.OPPONENT_DISCONNECTED;
  return DuelFinishReason.CANCELLED;
}

function variantForDuel(duel: PersistableDuel): GameVariant {
  return duel.mode === 'geo-challenge' ? GameVariant.GEO_CHALLENGE : GameVariant.CLASSIC;
}

function isRatingEligible(duel: PersistableDuel, reason: PersistDuelFinishReason): boolean {
  return Boolean(
    duel.rated &&
    duel.ladder &&
    (reason === 'completed' || (reason === 'opponent_disconnected' && duel.startedAt))
  );
}

function existingRatingChangeToApplied(change: {
  userId: string;
  ladder: CompetitiveLadder;
  outcome: AppliedRatingChange['outcome'];
  ratingBefore: number;
  ratingDelta: number;
  ratingAfter: number;
}): AppliedRatingChange {
  return {
    userId: change.userId,
    ladder: change.ladder,
    outcome: change.outcome,
    ratingBefore: change.ratingBefore,
    ratingDelta: change.ratingDelta,
    ratingAfter: change.ratingAfter,
    peakRating: change.ratingAfter,
    gamesPlayed: 0,
    provisional: false,
    placementGamesRemaining: 0,
    tier: getCompetitiveTier(change.ratingAfter, 5),
  };
}

export async function persistDuelResults(
  duel: PersistableDuel,
  winnerId: string | null,
  reason: PersistDuelFinishReason,
  db: Pick<PrismaClient, '$transaction'> = prisma
): Promise<PersistDuelResult> {
  const dueloVariant = variantForDuel(duel);
  const ratingEligible = isRatingEligible(duel, reason);
  const finishReason = finishReasonForPrisma(reason);

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    let duelMatch;
    try {
      duelMatch = await tx.duelMatch.create({
        data: {
          runId: duel.id,
          player1Id: duel.players[0].userId,
          player2Id: duel.players[1].userId,
          winnerId: winnerId ?? null,
          player1Score: duel.players[0].score,
          player2Score: duel.players[1].score,
          category: duel.category ?? null,
          variant: dueloVariant,
          rated: duel.rated,
          ladder: duel.ladder ?? null,
          finishReason,
          ratingVersion: ratingEligible ? RATING_VERSION : null,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        const existing = await tx.duelMatch.findUnique({
          where: { runId: duel.id },
          include: { ratingChanges: true },
        });
        if (existing) {
          return {
            persisted: false,
            duelMatch: existing,
            ratingEligible,
            ratingChanges: existing.ratingChanges.map(existingRatingChangeToApplied),
          };
        }
      }
      throw err;
    }

    for (const player of duel.players) {
      await saveGameResult(
        player.userId,
        player.answers,
        dueloVariant,
        GameMode.DUEL,
        duel.category,
        tx,
        `${duel.id}:${player.userId}`
      );

      await tx.user.update({
        where: { id: player.userId },
        data: {
          wins: player.userId === winnerId ? { increment: 1 } : undefined,
          losses: winnerId && player.userId !== winnerId ? { increment: 1 } : undefined,
        },
      });
    }

    const ratingChanges = ratingEligible
      ? await applyCompetitiveRatingForDuel(
          tx,
          duelMatch,
          { userId: duel.players[0].userId },
          { userId: duel.players[1].userId },
          winnerId,
          duel.ladder!
        )
      : [];

    return {
      persisted: true,
      duelMatch,
      ratingEligible,
      ratingChanges,
    };
  });
}
