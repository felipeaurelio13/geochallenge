import { describe, expect, it } from 'vitest';
import {
  createUnansweredResult,
  determineDuelWinner,
  shouldAutoCloseQuestion,
  shouldResolveQuestion,
  shouldForceStartDuel,
} from '../sockets/duel.utils.js';

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
