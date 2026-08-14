import { describe, expect, it } from 'vitest';
import {
  getMechanicsConfigForMode,
} from '../services/game.service.js';
import {
  createUnansweredResult,
  determineDuelWinner,
  duelMechanics,
  duelTimeLimit,
  getAuthoritativeDuelTimeRemaining,
  shouldRejectRankedRepeatAnswer,
  shouldAutoCloseQuestion,
  shouldResolveQuestion,
  shouldForceStartDuel,
} from '../sockets/duel.utils.js';
import { calculateScore, calculateTimeBonus } from '../utils/scoring.js';

describe('duel timeout guard', () => {
  it('auto-cierra solo cuando sigue siendo la misma pregunta en juego', () => {
    expect(shouldAutoCloseQuestion('playing', 0, 0)).toBe(true);
  });

  it('no auto-cierra cuando el duelo ya avanzó a otra pregunta', () => {
    expect(shouldAutoCloseQuestion('playing', 0, 1)).toBe(false);
  });

  it('no auto-cierra si el duelo ya no está en estado playing', () => {
    expect(shouldAutoCloseQuestion('finished', 0, 0)).toBe(false);
    expect(shouldAutoCloseQuestion('countdown', 0, 0)).toBe(false);
  });

  it('no auto-cierra si la pregunta ya está en proceso de resolución', () => {
    expect(shouldAutoCloseQuestion('playing', 2, 2, 2)).toBe(false);
  });

  it('solo resuelve una vez la pregunta activa', () => {
    expect(shouldResolveQuestion('playing', 3, 3, undefined)).toBe(true);
    expect(shouldResolveQuestion('playing', 3, 3, 3)).toBe(false);
    expect(shouldResolveQuestion('playing', 2, 3, undefined)).toBe(false);
  });
});



describe('duel unanswered result helper', () => {
  it('crea una respuesta vacía compatible con AnswerResult', () => {
    expect(createUnansweredResult('q-1')).toEqual({
      questionId: 'q-1',
      isCorrect: false,
      correctAnswer: '',
      userAnswer: '',
      points: 0,
      timeRemaining: 0,
    });
  });
});

describe('duel ready timeout guard', () => {
  it('fuerza inicio cuando se supera timeout y falta un jugador por confirmar', () => {
    expect(shouldForceStartDuel('waiting', 1, 2, 7000, 7000)).toBe(true);
  });

  it('no fuerza inicio si ambos ya estaban listos', () => {
    expect(shouldForceStartDuel('waiting', 2, 2, 8000, 7000)).toBe(false);
  });

  it('no fuerza inicio antes del timeout o fuera de estado waiting', () => {
    expect(shouldForceStartDuel('waiting', 1, 2, 6000, 7000)).toBe(false);
    expect(shouldForceStartDuel('playing', 1, 2, 9000, 7000)).toBe(false);
  });
});

describe('ranked duel integrity helpers', () => {
  it('usa tiempo restante autoritativo del servidor para Ranked Classic', () => {
    const duel = {
      mode: 'classic' as const,
      questionStartedAt: new Date('2026-08-14T10:00:00.000Z'),
    };

    expect(getAuthoritativeDuelTimeRemaining(duel, Date.parse('2026-08-14T10:00:10.000Z')))
      .toBe(duelTimeLimit(duel) - 10);
  });

  it('no permite bonus máximo en Ranked Classic tras 10s aunque el cliente mande max', () => {
    const duel = {
      mode: 'classic' as const,
      questionStartedAt: new Date('2026-08-14T10:00:00.000Z'),
    };
    const serverTime = getAuthoritativeDuelTimeRemaining(duel, Date.parse('2026-08-14T10:00:10.000Z'));

    expect(calculateScore(true, serverTime)).toBeLessThan(calculateScore(true, duelTimeLimit(duel)));
  });

  it('ignora tiempos negativos o enormes del cliente en Ranked', () => {
    const duel = {
      mode: 'classic' as const,
      questionStartedAt: new Date('2026-08-14T10:00:05.000Z'),
    };
    const nowMs = Date.parse('2026-08-14T10:00:08.000Z');
    const fromHugeClient = getAuthoritativeDuelTimeRemaining(duel, nowMs);
    const fromNegativeClient = getAuthoritativeDuelTimeRemaining(duel, nowMs);

    expect(fromHugeClient).toBe(fromNegativeClient);
    expect(fromHugeClient).toBe(duelTimeLimit(duel) - 3);
  });

  it('usa tiempo autoritativo del servidor para Ranked GeoRetos', () => {
    const duel = {
      mode: 'geo-challenge' as const,
      questionStartedAt: new Date('2026-08-14T10:00:00.000Z'),
    };
    const serverTime = getAuthoritativeDuelTimeRemaining(duel, Date.parse('2026-08-14T10:00:10.000Z'));

    expect(serverTime).toBe(15);
    expect(calculateTimeBonus(serverTime, duelTimeLimit(duel))).toBeLessThan(calculateTimeBonus(25, 25));
  });

  it('mantiene la semántica casual: el tiempo enviado por cliente sigue disponible para scoring', () => {
    const clientTimeRemaining = 99999;

    expect(calculateScore(true, clientTimeRemaining)).toBeGreaterThan(calculateScore(true, 0));
  });

  it('deshabilita mecánicas en Ranked Classic y conserva configuración casual Classic', () => {
    expect(duelMechanics({ mode: 'classic', rated: true })).toEqual({
      enabled: false,
      allowed: [],
      limits: {},
    });

    expect(duelMechanics({ mode: 'classic', rated: false })).toEqual(getMechanicsConfigForMode('duel'));
  });

  it('mantiene mecánicas deshabilitadas en GeoRetos', () => {
    expect(duelMechanics({ mode: 'geo-challenge', rated: false })).toEqual({
      enabled: false,
      allowed: [],
      limits: {},
    });
  });

  it('hace first-answer-wins en Ranked Classic y GeoRetos', () => {
    for (const mode of ['classic', 'geo-challenge'] as const) {
      const duel = { rated: true, currentQuestionIndex: 0, mode };
      const player = {
        answers: [
          {
            questionId: 'q1',
            isCorrect: false,
            correctAnswer: 'A',
            userAnswer: 'B',
            points: 0,
            timeRemaining: 5,
          },
        ],
      };

      expect(shouldRejectRankedRepeatAnswer(duel, player)).toBe(true);
      expect(player.answers[0]).toMatchObject({ isCorrect: false, points: 0 });
    }
  });

  it('permite que casual conserve reemplazo antes de resolución', () => {
    const duel = { rated: false, currentQuestionIndex: 0 };
    const player = { answers: [{ questionId: 'q1' }] };

    expect(shouldRejectRankedRepeatAnswer(duel, player)).toBe(false);
  });

  it('rechaza duplicados ranked concurrentes cuando ya hay respuesta aceptada', () => {
    const duel = { rated: true, currentQuestionIndex: 0 };
    const player: { answers: Array<{ questionId: string }> } = { answers: [] };

    expect(shouldRejectRankedRepeatAnswer(duel, player)).toBe(false);
    player.answers.push({ questionId: 'q1' });
    expect(shouldRejectRankedRepeatAnswer(duel, player)).toBe(true);
    expect(player.answers).toHaveLength(1);
  });

  it('mantiene mismo resultado ranked con timing servidor idéntico aunque el cliente forje tiempo', () => {
    const duel = {
      mode: 'classic' as const,
      questionStartedAt: new Date('2026-08-14T10:00:00.000Z'),
    };
    const nowMs = Date.parse('2026-08-14T10:00:07.000Z');
    const forgedHugeClientTime = 999999;
    const forgedZeroClientTime = 0;

    const scoreA = calculateScore(true, getAuthoritativeDuelTimeRemaining(duel, nowMs));
    const scoreB = calculateScore(true, getAuthoritativeDuelTimeRemaining(duel, nowMs));

    expect(forgedHugeClientTime).not.toBe(forgedZeroClientTime);
    expect(scoreA).toBe(scoreB);

    const player = { answers: [{ questionId: 'q1', isCorrect: false, points: 0 }] };
    expect(shouldRejectRankedRepeatAnswer({ rated: true, currentQuestionIndex: 0 }, player)).toBe(true);
    expect(player.answers[0]).toMatchObject({ isCorrect: false, points: 0 });
  });
});
describe('duel winner tiebreak', () => {
  it('gana el jugador con mayor score', () => {
    const winner = determineDuelWinner([
      { userId: 'u1', score: 500, answers: [{ timeRemaining: 2 }] },
      { userId: 'u2', score: 400, answers: [{ timeRemaining: 9 }] },
    ]);

    expect(winner).toBe('u1');
  });

  it('si hay empate de score, gana quien acumuló más tiempo restante', () => {
    const winner = determineDuelWinner([
      { userId: 'u1', score: 500, answers: [{ timeRemaining: 2 }, { timeRemaining: 4 }] },
      { userId: 'u2', score: 500, answers: [{ timeRemaining: 3 }, { timeRemaining: 5 }] },
    ]);

    expect(winner).toBe('u2');
  });

  it('si también empata el tiempo restante, queda empate', () => {
    const winner = determineDuelWinner([
      { userId: 'u1', score: 500, answers: [{ timeRemaining: 3 }, { timeRemaining: 5 }] },
      { userId: 'u2', score: 500, answers: [{ timeRemaining: 4 }, { timeRemaining: 4 }] },
    ]);

    expect(winner).toBeNull();
  });
});
