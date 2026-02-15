import { prisma } from '../config/database.js';
import { Category } from '@prisma/client';

const CHALLENGE_EXPIRY_DAYS = 7;
const QUESTIONS_PER_CHALLENGE = 10;
const ALLOWED_TIME_SECONDS = [10, 20, 30] as const;

interface ChallengeListItem {
  id: string;
  status: string;
  categories: Category[];
  maxPlayers: number;
  answerTimeSeconds: number;
  winnerId: string | null;
  createdAt: Date;
  expiresAt: Date;
  completedAt: Date | null;
  creator: {
    id: string;
    username: string;
  };
  participants: Array<{
    userId: string;
    score: number | null;
    joinedAt: Date;
    completedAt: Date | null;
    user: {
      id: string;
      username: string;
    };
  }>;
}

export class ChallengeService {
  async createChallenge(
    creatorId: string,
    categories: Category[] | undefined,
    maxPlayers: number,
    answerTimeSeconds: number
  ) {
    if (maxPlayers < 2 || maxPlayers > 8) {
      throw new Error('El desafío debe ser para entre 2 y 8 personas');
    }

    if (!ALLOWED_TIME_SECONDS.includes(answerTimeSeconds as (typeof ALLOWED_TIME_SECONDS)[number])) {
      throw new Error('El tiempo por pregunta debe ser 10, 20 o 30 segundos');
    }

    const selectedCategories: Category[] = categories?.length ? categories : ['MIXED'];
    const whereClause = selectedCategories.includes('MIXED')
      ? {}
      : { category: { in: selectedCategories } };

    const questions = await prisma.question.findMany({ where: whereClause, take: 200 });

    if (questions.length < QUESTIONS_PER_CHALLENGE) {
      throw new Error('No hay suficientes preguntas para las categorías seleccionadas');
    }

    const shuffled = questions.sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, QUESTIONS_PER_CHALLENGE);
    const questionIds = selectedQuestions.map((q) => q.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + CHALLENGE_EXPIRY_DAYS);

    const challenge = await prisma.challenge.create({
      data: {
        creatorId,
        categories: selectedCategories,
        maxPlayers,
        answerTimeSeconds,
        questionIds,
        expiresAt,
        participants: {
          create: {
            userId: creatorId,
          },
        },
      },
      include: this.challengeInclude,
    });

    return challenge;
  }

  async getChallenges(userId: string, type: 'mine' | 'joinable' | 'all' = 'all') {
    const now = new Date();
    await prisma.challenge.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED' },
    });

    const challenges = await prisma.challenge.findMany({
      where: type === 'mine'
        ? { participants: { some: { userId } } }
        : type === 'joinable'
          ? {
            status: 'PENDING',
            expiresAt: { gt: now },
            participants: { none: { userId } },
          }
          : {
            OR: [
              { participants: { some: { userId } } },
              {
                status: 'PENDING',
                expiresAt: { gt: now },
                participants: { none: { userId } },
              },
            ],
          },
      include: this.challengeInclude,
      orderBy: { createdAt: 'desc' },
    });

    return challenges.map((challenge) => this.toChallengeView(challenge, userId));
  }

  async getChallenge(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: this.challengeInclude,
    });

    if (!challenge) {
      throw new Error('Desafío no encontrado');
    }

    const isParticipant = challenge.participants.some((p) => p.userId === userId);
    const isJoinable =
      challenge.status === 'PENDING' &&
      challenge.expiresAt > new Date() &&
      challenge.participants.length < challenge.maxPlayers;

    if (!isParticipant && !isJoinable) {
      throw new Error('No tienes acceso a este desafío');
    }

    return this.toChallengeView(challenge, userId);
  }

  async joinChallenge(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { participants: true },
    });

    if (!challenge) {
      throw new Error('Desafío no encontrado');
    }

    if (challenge.status !== 'PENDING') {
      throw new Error('Este desafío ya no está disponible para unirse');
    }

    if (challenge.expiresAt < new Date()) {
      await prisma.challenge.update({ where: { id: challengeId }, data: { status: 'EXPIRED' } });
      throw new Error('Este desafío ha expirado');
    }

    if (challenge.participants.some((p) => p.userId === userId)) {
      throw new Error('Ya estás dentro de este desafío');
    }

    if (challenge.participants.length >= challenge.maxPlayers) {
      throw new Error('El desafío ya completó el cupo de jugadores');
    }

    const joined = await prisma.challenge.update({
      where: { id: challengeId },
      data: {
        participants: {
          create: { userId },
        },
      },
      include: this.challengeInclude,
    });

    return this.toChallengeView(joined, userId);
  }

  async getChallengeQuestions(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { participants: true },
    });

    if (!challenge) {
      throw new Error('Desafío no encontrado');
    }

    if (!challenge.participants.some((p) => p.userId === userId)) {
      throw new Error('Debes unirte al desafío para jugar');
    }

    if (challenge.status === 'PENDING') {
      if (challenge.participants.length < challenge.maxPlayers) {
        throw new Error('El desafío aún no completó el cupo de jugadores');
      }

      await prisma.challenge.update({
        where: { id: challengeId },
        data: { status: 'ACCEPTED' },
      });
    }

    if (challenge.status !== 'ACCEPTED' && challenge.status !== 'COMPLETED') {
      throw new Error('El desafío no está en estado jugable');
    }

    const participant = challenge.participants.find((p) => p.userId === userId);
    const alreadyPlayed = participant?.score !== null && participant?.score !== undefined;

    const questions = await prisma.question.findMany({ where: { id: { in: challenge.questionIds } } });
    const orderedQuestions = challenge.questionIds
      .map((id) => questions.find((q) => q.id === id))
      .filter(Boolean);

    return {
      questions: orderedQuestions,
      alreadyPlayed,
      answerTimeSeconds: challenge.answerTimeSeconds,
      challenge,
    };
  }

  async submitChallengeResult(
    challengeId: string,
    userId: string,
    score: number,
    correctCount: number
  ) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { participants: true },
    });

    if (!challenge) {
      throw new Error('Desafío no encontrado');
    }

    if (challenge.status !== 'ACCEPTED') {
      throw new Error('El desafío no está en estado jugable');
    }

    const participant = challenge.participants.find((p) => p.userId === userId);

    if (!participant) {
      throw new Error('No participas en este desafío');
    }

    if (participant.score !== null) {
      throw new Error('Ya has jugado este desafío');
    }

    await prisma.challengeParticipant.update({
      where: { id: participant.id },
      data: {
        score,
        correctCount,
        completedAt: new Date(),
      },
    });

    const updatedChallenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: this.challengeInclude,
    });

    if (!updatedChallenge) {
      throw new Error('Desafío no encontrado');
    }

    const everyonePlayed = updatedChallenge.participants.every((p) => p.score !== null);
    if (everyonePlayed) {
      const sorted = [...updatedChallenge.participants].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const topScore = sorted[0]?.score ?? 0;
      const tied = sorted.filter((p) => p.score === topScore);
      const winnerId = tied.length === 1 ? tied[0].userId : null;

      await prisma.challenge.update({
        where: { id: challengeId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          winnerId,
        },
      });

      await Promise.all(
        updatedChallenge.participants.map(async (p) => {
          const isWinner = winnerId === p.userId;
          const isLoss = winnerId !== null && winnerId !== p.userId;
          const userHighScore = await this.getUserHighScore(p.userId);
          await prisma.user.update({
            where: { id: p.userId },
            data: {
              gamesPlayed: { increment: 1 },
              wins: isWinner ? { increment: 1 } : undefined,
              losses: isLoss ? { increment: 1 } : undefined,
              highScore: (p.score ?? 0) > userHighScore ? (p.score ?? 0) : undefined,
            },
          });
        })
      );
    }

    const finalChallenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: this.challengeInclude,
    });

    return this.toChallengeView(finalChallenge!, userId);
  }

  private async getUserHighScore(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { highScore: true } });
    return user?.highScore || 0;
  }

  private readonly challengeInclude = {
    creator: { select: { id: true, username: true } },
    participants: {
      orderBy: { joinedAt: 'asc' as const },
      select: {
        id: true,
        userId: true,
        score: true,
        joinedAt: true,
        completedAt: true,
        user: { select: { id: true, username: true } },
      },
    },
  };

  private toChallengeView(challenge: ChallengeListItem, userId: string) {
    const participantsCount = challenge.participants.length;
    const isUserParticipant = challenge.participants.some((p) => p.userId === userId);

    return {
      ...challenge,
      participantsCount,
      isFull: participantsCount >= challenge.maxPlayers,
      isUserParticipant,
      isJoinable:
        challenge.status === 'PENDING' &&
        !isUserParticipant &&
        challenge.expiresAt > new Date() &&
        participantsCount < challenge.maxPlayers,
    };
  }
}

export const challengeService = new ChallengeService();
