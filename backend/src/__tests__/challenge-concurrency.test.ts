/**
 * P2 — Challenge concurrency fixes:
 *  - getChallengeQuestions: la transición PENDING → ACCEPTED ya no hace
 *    fallar el chequeo posterior (status local quedaba stale).
 *  - joinChallenge: join con bloqueo de fila (FOR UPDATE) para no exceder
 *    maxPlayers con joins concurrentes.
 *  - submitChallengeResult: cierre con CAS (ACCEPTED → COMPLETED) para no
 *    duplicar wins/losses/gamesPlayed con submits concurrentes del último
 *    participante.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { challengeService } from '../services/challenge.service.js';

const mocks = vi.hoisted(() => {
  const prismaStub: Record<string, any> = {
    $transaction: vi.fn(async (fn: (tx: Record<string, any>) => Promise<unknown>) => fn(prismaStub)),
    $queryRaw: vi.fn(async () => []),
    challenge: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    challengeParticipant: {
      create: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    question: { findMany: vi.fn() },
    masteryAttempt: { createMany: vi.fn(), findMany: vi.fn() },
    user: { update: vi.fn(), findUnique: vi.fn() },
    telemetryEvent: { create: vi.fn() },
  };
  return { prismaStub };
});

vi.mock('../config/database.js', () => ({ prisma: mocks.prismaStub }));

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);

function challengeRow(overrides: Record<string, any> = {}) {
  return {
    id: 'ch1',
    creatorId: 'creator-1',
    status: 'PENDING',
    categories: ['MIXED'],
    maxPlayers: 2,
    answerTimeSeconds: 10,
    questionIds: ['q1', 'q2'],
    winnerId: null,
    createdAt: new Date(),
    expiresAt: FUTURE,
    completedAt: null,
    creator: { id: 'creator-1', username: 'creator' },
    participants: [
      { id: 'p1', userId: 'u1', score: null, joinedAt: new Date(), completedAt: null, user: { id: 'u1', username: 'alice' } },
      { id: 'p2', userId: 'u2', score: null, joinedAt: new Date(), completedAt: null, user: { id: 'u2', username: 'bob' } },
    ],
    ...overrides,
  };
}

const QUESTIONS = [
  { id: 'q1', category: 'FLAG', correctAnswer: 'Chile', latitude: null, longitude: null },
  { id: 'q2', category: 'CAPITAL', correctAnswer: 'Lima', latitude: null, longitude: null },
];

beforeEach(() => {
  for (const model of Object.values(mocks.prismaStub) as Array<Record<string, any>>) {
    if (typeof model === 'object' && model !== null) {
      for (const method of Object.values(model)) {
        if (typeof method === 'function' && typeof method.mockReset === 'function') method.mockReset();
      }
    }
  }
  mocks.prismaStub.$queryRaw.mockReset().mockResolvedValue([]);
  mocks.prismaStub.$transaction.mockImplementation(
    (fn: (tx: Record<string, any>) => Promise<unknown>) => fn(mocks.prismaStub)
  );
  mocks.prismaStub.question.findMany.mockResolvedValue(QUESTIONS);
  mocks.prismaStub.masteryAttempt.createMany.mockResolvedValue({ count: 1 });
  mocks.prismaStub.telemetryEvent.create.mockResolvedValue({});
  mocks.prismaStub.challengeParticipant.findFirst.mockResolvedValue(null);
});

describe('getChallengeQuestions — transición PENDING → ACCEPTED', () => {
  it('desafío lleno en PENDING: transiciona a ACCEPTED y entrega preguntas', async () => {
    mocks.prismaStub.challenge.findUnique.mockResolvedValue(challengeRow({ status: 'PENDING' }));
    mocks.prismaStub.challenge.update.mockResolvedValue(challengeRow({ status: 'ACCEPTED' }));

    const result = await challengeService.getChallengeQuestions('ch1', 'u1');

    expect(mocks.prismaStub.challenge.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'ACCEPTED' } })
    );
    expect(result.questions).toHaveLength(2);
    expect(result.alreadyPlayed).toBe(false);
    expect(result.challenge.status).toBe('ACCEPTED');
  });

  it('desafío PENDING sin cupo lleno: CHALLENGE_NOT_FULL y no transiciona', async () => {
    mocks.prismaStub.challenge.findUnique.mockResolvedValue(
      challengeRow({ status: 'PENDING', participants: challengeRow().participants.slice(0, 1) })
    );

    await expect(challengeService.getChallengeQuestions('ch1', 'u1')).rejects.toMatchObject({
      code: 'CHALLENGE_NOT_FULL',
    });
    expect(mocks.prismaStub.challenge.update).not.toHaveBeenCalled();
  });

  it('desafío EXPIRED: CHALLENGE_NOT_PLAYABLE', async () => {
    mocks.prismaStub.challenge.findUnique.mockResolvedValue(
      challengeRow({ status: 'EXPIRED' })
    );

    await expect(challengeService.getChallengeQuestions('ch1', 'u1')).rejects.toMatchObject({
      code: 'CHALLENGE_NOT_PLAYABLE',
    });
    expect(mocks.prismaStub.challenge.update).not.toHaveBeenCalled();
  });
});

describe('joinChallenge — FOR UPDATE y límite de cupo', () => {
  const lockedRow = () => [{ id: 'ch1', status: 'PENDING', maxPlayers: 2, expiresAt: FUTURE }];

  it('toma bloqueo de fila (FOR UPDATE) antes de validar cupo', async () => {
    mocks.prismaStub.$queryRaw.mockResolvedValue(lockedRow());
    mocks.prismaStub.challengeParticipant.count.mockResolvedValue(1);
    mocks.prismaStub.challenge.update.mockResolvedValue(challengeRow({ status: 'PENDING' }));

    const view = await challengeService.joinChallenge('ch1', 'u3');

    const query = mocks.prismaStub.$queryRaw.mock.calls[0]?.[0] as TemplateStringsArray;
    expect(String(query.join('?'))).toContain('FOR UPDATE');
    // El join se materializa con un create anidado en challenge.update.
    expect(mocks.prismaStub.challenge.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { participants: { create: { userId: 'u3' } } },
      })
    );
  });

  it('cupo lleno: CHALLENGE_FULL y no crea participante', async () => {
    mocks.prismaStub.$queryRaw.mockResolvedValue(lockedRow());
    mocks.prismaStub.challengeParticipant.count.mockResolvedValue(2);

    await expect(challengeService.joinChallenge('ch1', 'u3')).rejects.toMatchObject({
      code: 'CHALLENGE_FULL',
    });
    expect(mocks.prismaStub.challenge.update).not.toHaveBeenCalled();
  });

  it('joins concurrentes nunca exceden maxPlayers (serialización por FOR UPDATE)', async () => {
    // El estado compartido modela el lock de fila: $transaction serializa los
    // callbacks (como hace el FOR UPDATE en la DB), así el count dentro de
    // cada transacción refleja los joins ya commiteados.
    let participantCount = 1;
    let chain = Promise.resolve();
    mocks.prismaStub.$transaction.mockImplementation((fn: (tx: Record<string, any>) => Promise<unknown>) => {
      const run = chain.then(() => fn(mocks.prismaStub));
      chain = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    });
    mocks.prismaStub.$queryRaw.mockResolvedValue(lockedRow());
    mocks.prismaStub.challengeParticipant.count.mockImplementation(() => Promise.resolve(participantCount));
    // El create anidado del join incrementa el cupo usado.
    mocks.prismaStub.challenge.update.mockImplementation(() => {
      participantCount += 1;
      return Promise.resolve(challengeRow({ status: 'PENDING' }));
    });

    const results = await Promise.allSettled([
      challengeService.joinChallenge('ch1', 'u3'),
      challengeService.joinChallenge('ch1', 'u4'),
    ]);

    expect(participantCount).toBe(2);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'CHALLENGE_FULL' });
  });
});

describe('submitChallengeResult — cierre CAS sin doble conteo', () => {
  it('dos submits concurrentes del último participante: solo un CAS actualiza stats', async () => {
    const state: {
      status: string;
      participants: Record<string, { id: string; userId: string; score: number | null }>;
    } = {
      status: 'ACCEPTED',
      participants: {
        p1: { id: 'p1', userId: 'u1', score: null },
        p2: { id: 'p2', userId: 'u2', score: null },
      },
    };

    mocks.prismaStub.challenge.findUnique.mockImplementation(() =>
      Promise.resolve({
        ...challengeRow({ status: state.status, winnerId: null }),
        participants: Object.values(state.participants).map((p) => ({
          id: p.id,
          userId: p.userId,
          score: p.score,
          joinedAt: new Date(),
          completedAt: p.score !== null ? new Date() : null,
          user: { id: p.userId, username: p.userId },
        })),
      })
    );
    mocks.prismaStub.challengeParticipant.update.mockImplementation(({
      where,
      data,
    }: {
      where: { id: string };
      data: { score: number; correctCount: number; completedAt: Date };
    }) => {
      state.participants[where.id].score = data.score;
      return Promise.resolve({});
    });
    mocks.prismaStub.challenge.updateMany.mockImplementation(({ where, data }: any) => {
      if (where.status === 'ACCEPTED' && state.status === 'ACCEPTED') {
        state.status = data.status;
        return Promise.resolve({ count: 1 });
      }
      return Promise.resolve({ count: 0 });
    });

    await Promise.all([
      challengeService.submitChallengeResult('ch1', 'u1', [{ questionId: 'q1', answer: 'Chile', timeRemaining: 5 }]),
      challengeService.submitChallengeResult('ch1', 'u2', [{ questionId: 'q2', answer: 'Lima', timeRemaining: 5 }]),
    ]);

    // El estado terminó COMPLETED y solo el request ganador del CAS incrementó stats.
    expect(state.status).toBe('COMPLETED');
    const calls = mocks.prismaStub.challenge.updateMany.mock.calls.map((c: any[]) => c[0]);
    expect(calls.filter((c: any) => c.where.status === 'ACCEPTED')).toHaveLength(2);
    // 2 participantes x 1 actualización de stats (no 4).
    expect(mocks.prismaStub.user.update).toHaveBeenCalledTimes(2);
  });
});