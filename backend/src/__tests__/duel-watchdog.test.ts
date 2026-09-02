import { describe, expect, it } from 'vitest';
import { MatchmakingQueue, isDuelZombie, type ActiveDuel } from '../sockets/duel.handler.js';

function buildDuel(overrides: Partial<ActiveDuel> = {}): ActiveDuel {
  const now = new Date();
  return {
    id: 'duel_test',
    players: [
      { userId: 'u1', username: 'uno', socketId: 's1', answers: [], score: 0, ready: true },
      { userId: 'u2', username: 'dos', socketId: 's2', answers: [], score: 0, ready: true },
    ],
    questions: [],
    questionsData: [],
    currentQuestionIndex: 0,
    status: 'playing',
    mode: 'classic',
    rated: false,
    createdAt: now,
    ...overrides,
  };
}

describe('isDuelZombie', () => {
  it('no marca como zombie un duelo playing reciente', () => {
    const duel = buildDuel({ questionStartedAt: new Date() });
    expect(isDuelZombie(duel, Date.now())).toBe(false);
  });

  it('marca zombie un duelo playing cuyo ancla excede la vida máxima del juego', () => {
    const longAgo = new Date(Date.now() - 60 * 60 * 1000);
    const duel = buildDuel({ questionStartedAt: longAgo });
    expect(isDuelZombie(duel, Date.now())).toBe(true);
  });

  it('usa startedAt como ancla cuando no hay questionStartedAt', () => {
    const longAgo = new Date(Date.now() - 60 * 60 * 1000);
    const duel = buildDuel({ startedAt: longAgo });
    expect(isDuelZombie(duel, Date.now())).toBe(true);
  });

  it('marca zombie un duelo waiting viejo aunque no haya empezado', () => {
    const duel = buildDuel({ status: 'waiting', createdAt: new Date(Date.now() - 3 * 60 * 1000) });
    expect(isDuelZombie(duel, Date.now())).toBe(true);
  });

  it('no marca zombie un waiting reciente', () => {
    const duel = buildDuel({ status: 'waiting', createdAt: new Date() });
    expect(isDuelZombie(duel, Date.now())).toBe(false);
  });

  it('nunca marca finalizing como zombie (endDuel tiene su propio retry)', () => {
    const duel = buildDuel({ status: 'finalizing', questionStartedAt: new Date(Date.now() - 60 * 60 * 1000) });
    expect(isDuelZombie(duel, Date.now())).toBe(false);
  });
});

describe('MatchmakingQueue.pruneStale', () => {
  it('elimina solo entradas más viejas que el corte', () => {
    const queue = new MatchmakingQueue();
    queue.addPlayer({
      userId: 'old',
      username: 'viejo',
      socketId: 's-old',
      joinedAt: new Date(Date.now() - 10 * 60 * 1000),
      category: 'FLAG',
    });
    queue.addPlayer({
      userId: 'fresh',
      username: 'nuevo',
      socketId: 's-fresh',
      joinedAt: new Date(),
      category: 'FLAG',
    });

    const removed = queue.pruneStale(5 * 60 * 1000);

    expect(removed).toBe(1);
    expect(queue.isInQueue('old')).toBe(false);
    expect(queue.isInQueue('fresh')).toBe(true);
  });
});
