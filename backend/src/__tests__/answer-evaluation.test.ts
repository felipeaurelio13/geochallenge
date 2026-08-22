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
];

describe('evaluateTimedAnswers', () => {
  it('puntúa base por acierto sin bonus de tiempo (asíncrono)', () => {
    const { score, correctCount } = evaluateTimedAnswers(
      QUESTIONS,
      [{ questionId: 'q1', answer: 'Chile', timeRemaining: 5 }],
      10
    );
    // 100 base, sin bonus de tiempo (el score no depende del timeRemaining)
    expect(score).toBe(100);
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

  it('el score NO depende del timeRemaining del cliente (solo se recorta para telemetría)', () => {
    const { score, details } = evaluateTimedAnswers(
      QUESTIONS,
      [
        { questionId: 'q1', answer: 'Chile', timeRemaining: 999 },
        { questionId: 'q2', answer: 'Lima', timeRemaining: 999 },
      ],
      10
    );
    // Sin bonus de tiempo: cada acierto vale exactamente basePoints.
    expect(score).toBe(200);
    // El valor para telemetría queda recortado a la duración.
    for (const d of details) {
      if (d.isCorrect) expect(d.timeRemaining).toBeLessThanOrEqual(10);
    }
  });

  it('MAP: puntúa por precisión con haversine y umbral de 500km (sin bonus de tiempo)', () => {
    // Respuesta exacta: accuracy 1 → 100 (solo precisión)
    const exact = evaluateTimedAnswers(
      QUESTIONS,
      [{ questionId: 'q3', mapAnswer: { lat: -33.45, lng: -70.66 }, timeRemaining: 10 }],
      10
    );
    expect(exact.score).toBe(100);
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

  it('answers=[] produce un detail incorrecto por cada pregunta', () => {
    const subset = QUESTIONS.slice(0, 3);
    const result = evaluateTimedAnswers(subset, [], 10);

    expect(result.score).toBe(0);
    expect(result.correctCount).toBe(0);
    expect(result.details).toHaveLength(3);
    for (const d of result.details) {
      expect(d.isCorrect).toBe(false);
      expect(d.points).toBe(0);
      expect(d.timeRemaining).toBe(0);
    }
  });

  it('1 answer de 3 questions: 2 faltantes incorrectas', () => {
    const subset = QUESTIONS.slice(0, 3);
    const result = evaluateTimedAnswers(
      subset,
      [{ questionId: 'q1', answer: 'Chile', timeRemaining: 5 }],
      10
    );

    expect(result.details).toHaveLength(3);
    const answered = result.details.find((d) => d.questionId === 'q1');
    expect(answered?.isCorrect).toBe(true);
    expect(answered?.points).toBeGreaterThan(0);

    const missing = result.details.filter((d) => d.questionId !== 'q1');
    expect(missing).toHaveLength(2);
    for (const d of missing) {
      expect(d.isCorrect).toBe(false);
      expect(d.points).toBe(0);
      expect(d.timeRemaining).toBe(0);
    }
  });

  it('3 answers de 3 questions: comportamiento existente intacto', () => {
    const subset = QUESTIONS.slice(0, 3);
    const result = evaluateTimedAnswers(
      subset,
      [
        { questionId: 'q1', answer: 'Chile', timeRemaining: 5 },
        { questionId: 'q2', answer: 'Lima', timeRemaining: 5 },
        { questionId: 'q3', mapAnswer: { lat: -33.45, lng: -70.66 }, timeRemaining: 10 },
      ],
      10
    );

    expect(result.details).toHaveLength(3);
    expect(result.correctCount).toBe(3);
    expect(result.score).toBeGreaterThan(0);
    for (const d of result.details) {
      expect(d.isCorrect).toBe(true);
      expect(d.points).toBeGreaterThan(0);
    }
  });

  it('duplicate questionId sigue rechazándose', () => {
    const subset = QUESTIONS.slice(0, 3);
    expect(() =>
      evaluateTimedAnswers(
        subset,
        [
          { questionId: 'q1', answer: 'Chile', timeRemaining: 5 },
          { questionId: 'q1', answer: 'Chile', timeRemaining: 5 },
        ],
        10
      )
    ).toThrow(/más de una vez/);
  });
});
