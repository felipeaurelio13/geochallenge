import { prisma } from '../config/database.js';
import { Category, ChallengeStatus } from '@prisma/client';

const CHALLENGE_EXPIRY_DAYS = 7;
const QUESTIONS_PER_CHALLENGE = 10;

export class ChallengeService {
  /**
   * Create a new challenge
   */
  async createChallenge(
    challengerId: string,
    challengedUsername: string,
    category?: Category
  ) {
    // Find challenged user
    const challengedUser = await prisma.user.findUnique({
      where: { username: challengedUsername },
    });

    if (!challengedUser) {
      throw new Error('Usuario no encontrado');
    }

    if (challengedUser.id === challengerId) {
      throw new Error('No puedes desafiarte a ti mismo');
    }

    // Get questions for the challenge
    const whereClause = category && category !== 'MIXED' ? { category } : {};
    const questions = await prisma.question.findMany({
      where: whereClause,
      take: 100,
    });

    // Shuffle and select questions
    const shuffled = questions.sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, QUESTIONS_PER_CHALLENGE);
    const questionIds = selectedQuestions.map((q) => q.id);

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CHALLENGE_EXPIRY_DAYS);

    // Create challenge
    const challenge = await prisma.challenge.create({
      data: {
        challengerId,
        challengedId: challengedUser.id,
        category,
        questionIds,
        expiresAt,
      },
      include: {
        challenger: {
          select: { id: true, username: true },
        },
        challenged: {
          select: { id: true, username: true },
        },
      },
    });

    return challenge;
  }

  /**
   * Get challenges for a user
   */
  async getChallenges(userId: string, type: 'sent' | 'received' | 'all' = 'all') {
    const whereClause: any = {};

    if (type === 'sent') {
      whereClause.challengerId = userId;
    } else if (type === 'received') {
      whereClause.challengedId = userId;
    } else {
      whereClause.OR = [{ challengerId: userId }, { challengedId: userId }];
    }

    const challenges = await prisma.challenge.findMany({
      where: whereClause,
      include: {
        challenger: {
          select: { id: true, username: true },
        },
        challenged: {
          select: { id: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Update expired challenges
    const now = new Date();
    const expiredIds = challenges
      .filter((c) => c.status === 'PENDING' && c.expiresAt < now)
      .map((c) => c.id);

    if (expiredIds.length > 0) {
      await prisma.challenge.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: 'EXPIRED' },
      });
    }

    return challenges.map((c) => ({
      ...c,
      status: expiredIds.includes(c.id) ? 'EXPIRED' : c.status,
    }));
  }

  /**
   * Get a specific challenge with questions
   */
  async getChallenge(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        challenger: {
          select: { id: true, username: true },
        },
        challenged: {
          select: { id: true, username: true },
        },
      },
    });

    if (!challenge) {
      throw new Error('Desafio no encontrado');
    }

    // Verify user is part of challenge
    if (challenge.challengerId !== userId && challenge.challengedId !== userId) {
      throw new Error('No tienes acceso a este desafio');
    }

    return challenge;
  }

  /**
   * Accept a challenge
   */
  async acceptChallenge(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new Error('Desafio no encontrado');
    }

    if (challenge.challengedId !== userId) {
      throw new Error('No puedes aceptar este desafio');
    }

    if (challenge.status !== 'PENDING') {
      throw new Error('Este desafio ya no esta pendiente');
    }

    if (challenge.expiresAt < new Date()) {
      await prisma.challenge.update({
        where: { id: challengeId },
        data: { status: 'EXPIRED' },
      });
      throw new Error('Este desafio ha expirado');
    }

    const updated = await prisma.challenge.update({
      where: { id: challengeId },
      data: { status: 'ACCEPTED' },
      include: {
        challenger: {
          select: { id: true, username: true },
        },
        challenged: {
          select: { id: true, username: true },
        },
      },
    });

    return updated;
  }

  /**
   * Decline a challenge
   */
  async declineChallenge(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new Error('Desafio no encontrado');
    }

    if (challenge.challengedId !== userId) {
      throw new Error('No puedes rechazar este desafio');
    }

    if (challenge.status !== 'PENDING') {
      throw new Error('Este desafio ya no esta pendiente');
    }

    const updated = await prisma.challenge.update({
      where: { id: challengeId },
      data: { status: 'DECLINED' },
    });

    return updated;
  }

  /**
   * Get questions for playing a challenge
   */
  async getChallengeQuestions(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new Error('Desafio no encontrado');
    }

    // Verify user is part of challenge
    if (challenge.challengerId !== userId && challenge.challengedId !== userId) {
      throw new Error('No tienes acceso a este desafio');
    }

    // Challenge must be accepted or completed (for reviewing)
    if (challenge.status !== 'ACCEPTED' && challenge.status !== 'COMPLETED') {
      throw new Error('El desafio debe estar aceptado para jugar');
    }

    // Check if user already played (for challenger, check challengerScore)
    const isChallenger = challenge.challengerId === userId;
    const alreadyPlayed = isChallenger
      ? challenge.challengerScore !== null
      : challenge.challengedScore !== null;

    // Get questions
    const questions = await prisma.question.findMany({
      where: { id: { in: challenge.questionIds } },
    });

    // Sort questions to match the original order
    const orderedQuestions = challenge.questionIds.map((id) =>
      questions.find((q) => q.id === id)
    ).filter(Boolean);

    return {
      questions: orderedQuestions,
      alreadyPlayed,
      challenge,
    };
  }

  /**
   * Submit challenge result
   */
  async submitChallengeResult(
    challengeId: string,
    userId: string,
    score: number,
    correctCount: number
  ) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) {
      throw new Error('Desafio no encontrado');
    }

    if (challenge.challengerId !== userId && challenge.challengedId !== userId) {
      throw new Error('No tienes acceso a este desafio');
    }

    if (challenge.status !== 'ACCEPTED') {
      throw new Error('El desafio no esta en estado jugable');
    }

    const isChallenger = challenge.challengerId === userId;
    const updateData: any = {};

    if (isChallenger) {
      if (challenge.challengerScore !== null) {
        throw new Error('Ya has jugado este desafio');
      }
      updateData.challengerScore = score;
    } else {
      if (challenge.challengedScore !== null) {
        throw new Error('Ya has jugado este desafio');
      }
      updateData.challengedScore = score;
    }

    // Check if both players have played
    const newChallengerScore = isChallenger ? score : challenge.challengerScore;
    const newChallengedScore = isChallenger ? challenge.challengedScore : score;

    if (newChallengerScore !== null && newChallengedScore !== null) {
      // Challenge is complete - determine winner
      updateData.status = 'COMPLETED';
      updateData.completedAt = new Date();

      if (newChallengerScore > newChallengedScore) {
        updateData.winnerId = challenge.challengerId;
      } else if (newChallengedScore > newChallengerScore) {
        updateData.winnerId = challenge.challengedId;
      }
      // If equal, winnerId stays null (tie)

      // Update user stats
      await prisma.$transaction([
        prisma.user.update({
          where: { id: challenge.challengerId },
          data: {
            gamesPlayed: { increment: 1 },
            wins: updateData.winnerId === challenge.challengerId ? { increment: 1 } : undefined,
            losses: updateData.winnerId === challenge.challengedId ? { increment: 1 } : undefined,
            highScore: newChallengerScore > (await this.getUserHighScore(challenge.challengerId))
              ? newChallengerScore
              : undefined,
          },
        }),
        prisma.user.update({
          where: { id: challenge.challengedId },
          data: {
            gamesPlayed: { increment: 1 },
            wins: updateData.winnerId === challenge.challengedId ? { increment: 1 } : undefined,
            losses: updateData.winnerId === challenge.challengerId ? { increment: 1 } : undefined,
            highScore: newChallengedScore > (await this.getUserHighScore(challenge.challengedId))
              ? newChallengedScore
              : undefined,
          },
        }),
      ]);
    }

    const updated = await prisma.challenge.update({
      where: { id: challengeId },
      data: updateData,
      include: {
        challenger: {
          select: { id: true, username: true },
        },
        challenged: {
          select: { id: true, username: true },
        },
      },
    });

    return updated;
  }

  private async getUserHighScore(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { highScore: true },
    });
    return user?.highScore || 0;
  }
}

export const challengeService = new ChallengeService();
