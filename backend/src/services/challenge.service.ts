import { prisma } from '../config/database.js';
import { Category, Prisma } from '@prisma/client';
import { updateLeaderboardScore, updateSeasonLeaderboardScore } from './leaderboard.service.js';
import { QuestionFilters } from './game.service.js';
import { evaluateTimedAnswers, SubmittedAnswer } from '../utils/answerEvaluation.js';
import { AppError } from '../utils/appError.js';

const CHALLENGE_EXPIRY_DAYS = 7;
const QUESTIONS_PER_CHALLENGE = 10;
const ALLOWED_TIME_SECONDS = [10, 20, 30] as const;

interface ChallengeListItem {
  id: string;
  status: string;
  categories: Category[];
  maxPlayers: number;
  answerTimeSeconds: number;
  filters: Prisma.JsonValue | null;
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
    answerTimeSeconds: number,
    filters?: QuestionFilters
  ) {
    if (maxPlayers < 2 || maxPlayers > 8) {
      throw new AppError('CHALLENGE_PLAYER_RANGE', 400, 'El desafío debe ser para entre 2 y 8 personas', {
        min: 2,
        max: 8,
      });
    }

    if (!ALLOWED_TIME_SECONDS.includes(answerTimeSeconds as (typeof ALLOWED_TIME_SECONDS)[number])) {
      throw new AppError(
        'CHALLENGE_INVALID_ANSWER_TIME',
        400,
        'El tiempo por pregunta debe ser 10, 20 o 30 segundos'
      );
    }

    const selectedCategories: Category[] = categories?.length ? categories : ['MIXED'];
    const categoryClause = selectedCategories.includes('MIXED')
      ? {}
      : { category: { in: selectedCategories } };

    const filterClause = filters ? {
      ...(filters.continent && { continent: filters.continent }),
      ...(filters.isInsular !== undefined && { isInsular: filters.isInsular }),
      ...(filters.isLandlocked !== undefined && { isLandlocked: filters.isLandlocked }),
      ...(filters.difficulty && { difficulty: filters.difficulty }),
    } : {};

    const questions = await prisma.question.findMany({
      where: { ...categoryClause, ...filterClause, isAvailable: true },
      take: 200,
    });

    if (questions.length < QUESTIONS_PER_CHALLENGE) {
      throw new AppError(
        'CHALLENGE_NOT_ENOUGH_QUESTIONS',
        400,
        'No hay suficientes preguntas para las categorías seleccionadas'
      );
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
        filters: filters ? (filters as unknown as Prisma.InputJsonObject) : undefined,
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
      throw new AppError('CHALLENGE_NOT_FOUND', 404, 'Desafío no encontrado');
    }

    const isParticipant = challenge.participants.some((p) => p.userId === userId);
    const isJoinable =
      challenge.status === 'PENDING' &&
      challenge.expiresAt > new Date() &&
      challenge.participants.length < challenge.maxPlayers;

    if (!isParticipant && !isJoinable) {
      throw new AppError('CHALLENGE_ACCESS_DENIED', 403, 'No tienes acceso a este desafío');
    }

    return this.toChallengeView(challenge, userId);
  }

  async joinChallenge(challengeId: string, userId: string) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { participants: true },
    });

    if (!challenge) {
      throw new AppError('CHALLENGE_NOT_FOUND', 404, 'Desafío no encontrado');
    }

    if (challenge.status !== 'PENDING') {
      throw new AppError('CHALLENGE_NOT_JOINABLE', 400, 'Este desafío ya no está disponible para unirse');
    }

    if (challenge.expiresAt < new Date()) {
      await prisma.challenge.update({ where: { id: challengeId }, data: { status: 'EXPIRED' } });
      throw new AppError('CHALLENGE_EXPIRED', 400, 'Este desafío ha expirado');
    }

    if (challenge.participants.some((p) => p.userId === userId)) {
      throw new AppError('CHALLENGE_ALREADY_JOINED', 400, 'Ya estás dentro de este desafío');
    }

    if (challenge.participants.length >= challenge.maxPlayers) {
      throw new AppError('CHALLENGE_FULL', 400, 'El desafío ya completó el cupo de jugadores');
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
      throw new AppError('CHALLENGE_NOT_FOUND', 404, 'Desafío no encontrado');
    }

    if (!challenge.participants.some((p) => p.userId === userId)) {
      throw new AppError('CHALLENGE_NOT_JOINED', 403, 'Debes unirte al desafío para jugar');
    }

    if (challenge.status === 'PENDING') {
      if (challenge.participants.length < challenge.maxPlayers) {
        throw new AppError('CHALLENGE_NOT_FULL', 400, 'El desafío aún no completó el cupo de jugadores');
      }

      await prisma.challenge.update({
        where: { id: challengeId },
        data: { status: 'ACCEPTED' },
      });
    }

    if (challenge.status !== 'ACCEPTED' && challenge.status !== 'COMPLETED') {
      throw new AppError('CHALLENGE_NOT_PLAYABLE', 400, 'El desafío no está en estado jugable');
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
    answers: SubmittedAnswer[]
  ) {
    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { participants: true },
    });

    if (!challenge) {
      throw new AppError('CHALLENGE_NOT_FOUND', 404, 'Desafío no encontrado');
    }

    if (challenge.status !== 'ACCEPTED') {
      throw new AppError('CHALLENGE_NOT_PLAYABLE', 400, 'El desafío no está en estado jugable');
    }

    const participant = challenge.participants.find((p) => p.userId === userId);

    if (!participant) {
      throw new AppError('CHALLENGE_NOT_PARTICIPANT', 403, 'No participas en este desafío');
    }

    if (participant.score !== null) {
      throw new AppError('CHALLENGE_ALREADY_PLAYED', 400, 'Ya has jugado este desafío');
    }

    const questions = await prisma.question.findMany({
      where: { id: { in: challenge.questionIds } },
      select: { id: true, category: true, correctAnswer: true, latitude: true, longitude: true },
    });

    const { score, correctCount } = evaluateTimedAnswers(
      questions,
      answers,
      challenge.answerTimeSeconds
    );

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
      throw new AppError('CHALLENGE_NOT_FOUND', 404, 'Desafío no encontrado');
    }

    const everyonePlayed = updatedChallenge.participants.every((p) => p.score !== null);
    if (everyonePlayed) {
      const sorted = [...updatedChallenge.participants].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      const topScore = sorted[0]?.score ?? 0;
      const tied = sorted.filter((p) => p.score === topScore);
      const winnerId = tied.length === 1 ? tied[0].userId : null;

      // Cierre atómico: status + stats de todos los participantes, o nada.
      await prisma.$transaction(async (tx) => {
        await tx.challenge.update({
          where: { id: challengeId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            winnerId,
          },
        });

        for (const p of updatedChallenge.participants) {
          const isWinner = winnerId === p.userId;
          const isLoss = winnerId !== null && winnerId !== p.userId;
          const user = await tx.user.findUnique({
            where: { id: p.userId },
            select: { highScore: true },
          });
          const newScore = p.score ?? 0;
          const isHighScore = newScore > (user?.highScore ?? 0);

          await tx.user.update({
            where: { id: p.userId },
            data: {
              gamesPlayed: { increment: 1 },
              wins: isWinner ? { increment: 1 } : undefined,
              losses: isLoss ? { increment: 1 } : undefined,
              highScore: isHighScore ? newScore : undefined,
            },
          });
        }
      });

      // Leaderboards (Redis) fuera de la transacción: best-effort, pero logueado.
      for (const p of updatedChallenge.participants) {
        const newScore = p.score ?? 0;
        await Promise.all([
          updateLeaderboardScore(p.userId, newScore),
          updateSeasonLeaderboardScore(p.userId, newScore),
        ]).catch((err) => {
          console.error(`[challenge] leaderboard update failed for ${p.userId}:`, err);
        });
      }
    }

    const finalChallenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: this.challengeInclude,
    });

    return {
      challenge: this.toChallengeView(finalChallenge!, userId),
      result: { score, correctCount },
    };
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
