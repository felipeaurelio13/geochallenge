import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/env.js', () => ({
  config: {
    game: {
      basePoints: 100,
      maxTimeBonus: 50,
      mechanics: { focusTimeBonusSeconds: 3 },
    },
  },
}));

import { evaluateTimedAnswers, EvaluableQuestion } from '../utils/answerEvaluation';

const QUESTIONS: EvaluableQuestion[] = [
  { id: 'q1', category: 'FLAG', correctAnswer: 'Chile' },
  { id: 'q2', category: 'CAPITAL', correctAnswer: 'Lima' },
  { id: 'q3', category: 'MAP', correctAnswer: '', latitude: -33.45, longitude: -70.66 },
  { id: 'q4', category: 'CINEMA_GEO', correctAnswer: 'Dubai' },
];

describe('evaluateTimedAnswers', () => {
  it('calcula el puntaje con la misma fórmula que el cliente (base + bonus de tiempo)', () => {
    const { score, correctCount } = evaluateTimedAnswers(
      QUESTIONS,
      [{ questionId: 'q1', answer: 'Chile', timeRemaining: 5 }],
      10
    );
    // 100 base + round((5/10) * 50) = 125
    expect(score).toBe(125);
    expect(correctCount).toBe(1);
  });

  it('respuesta incorrecta o vacía no suma puntos', () => {
    const { score, correctCount } = evaluateTimedAnswers(
      QUESTIONS,
      [
        { questionId: 'q1', answer: 'Argentina', timeRemaining: 10 },
        { questionId: 'q2', timeRemaining: 10 },
      ],
      10
    );
    expect(score).toBe(0);
    expect(correctCount).toBe(0);
  });

  it('rechaza preguntas que no pertenecen a la partida', () => {
    expect(() =>
      evaluateTimedAnswers(QUESTIONS, [{ questionId: 'hacked', answer: 'X', timeRemaining: 5 }], 10)
    ).toThrow(/no pertenece/);
  });

  it('rechaza la misma pregunta respondida dos veces', () => {
    expect(() =>
      evaluateTimedAnswers(
        QUESTIONS,
        [
          { questionId: 'q1', answer: 'Chile', timeRemaining: 5 },
          { questionId: 'q1', answer: 'Chile', timeRemaining: 5 },
        ],
        10
      )
    ).toThrow(/más de una vez/);
  });

  it('rechaza más respuestas que preguntas', () => {
    const answers = Array.from({ length: 5 }, (_, i) => ({
      questionId: `q${i}`,
      answer: 'X',
      timeRemaining: 5,
    }));
    expect(() => evaluateTimedAnswers(QUESTIONS, answers, 10)).toThrow(/más respuestas/);
  });

  it('recorta timeRemaining inflado: solo un Focus Time (+3s) por partida', () => {
    const { score } = evaluateTimedAnswers(
      QUESTIONS,
      [
        // Primer exceso: permitido hasta duration + 3 → bonus round((13/10)*50) = 65
        { questionId: 'q1', answer: 'Chile', timeRemaining: 999 },
        // Segundo exceso: recortado a duration → bonus 50
        { questionId: 'q2', answer: 'Lima', timeRemaining: 999 },
      ],
      10
    );
    expect(score).toBe(100 + 65 + 100 + 50);
  });

  it('MAP: puntúa por precisión con haversine y umbral de 500km', () => {
    // Respuesta exacta: accuracy 1 → 100 + bonus completo
    const exact = evaluateTimedAnswers(
      QUESTIONS,
      [{ questionId: 'q3', mapAnswer: { lat: -33.45, lng: -70.66 }, timeRemaining: 10 }],
      10
    );
    expect(exact.score).toBe(150);
    expect(exact.correctCount).toBe(1);

    // Muy lejos (> 500km): incorrecta, 0 puntos
    const far = evaluateTimedAnswers(
      QUESTIONS,
      [{ questionId: 'q3', mapAnswer: { lat: 40, lng: -3 }, timeRemaining: 10 }],
      10
    );
    expect(far.score).toBe(0);
    expect(far.correctCount).toBe(0);
  });

  it('CINEMA_GEO: el tiempo extra de lectura no infla el bonus', () => {
    // Duración real = 10 + 5 = 15, pero el bonus se calcula sobre máx 10.
    const { score } = evaluateTimedAnswers(
      QUESTIONS,
      [{ questionId: 'q4', answer: 'Dubai', timeRemaining: 15 }],
      10
    );
    expect(score).toBe(150);
  });
});
