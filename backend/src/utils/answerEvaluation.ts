import { config } from '../config/env.js';
import { haversineDistance } from './haversine.js';

/**
 * Evaluación server-side de respuestas enviadas por el cliente al terminar
 * una partida asíncrona (challenges). El cliente ya no manda `score`: manda
 * sus respuestas y el servidor las valida contra la DB y calcula el puntaje
 * con la MISMA fórmula que muestra la UI (ver ChallengeGamePage.calculatePoints),
 * para que el número que vio el jugador coincida con el persistido.
 */

export interface SubmittedAnswer {
  questionId: string;
  answer?: string;
  mapAnswer?: { lat: number; lng: number };
  timeRemaining: number;
}

export interface EvaluableQuestion {
  id: string;
  category: string;
  correctAnswer: string;
  latitude?: number | null;
  longitude?: number | null;
}

const MAP_CORRECT_THRESHOLD_KM = 500;
const MAP_MAX_DISTANCE_KM = 2000;

export interface AnswerDetail {
  questionId: string;
  isCorrect: boolean;
  points: number;
  timeRemaining: number;
  distanceBucket?: string;
}

export function evaluateTimedAnswers(
  questions: EvaluableQuestion[],
  answers: SubmittedAnswer[],
  answerTimeSeconds: number
): { score: number; correctCount: number; details: AnswerDetail[] } {
  if (answers.length > questions.length) {
    throw new Error('Respuestas inválidas: más respuestas que preguntas');
  }

  const byId = new Map(questions.map((q) => [q.id, q]));
  const seen = new Set<string>();
  let focusAllowance = 1;
  const focusBonus = config.game.mechanics.focusTimeBonusSeconds;

  let score = 0;
  let correctCount = 0;
  const details: AnswerDetail[] = [];

  for (const submitted of answers) {
    const question = byId.get(submitted.questionId);
    if (!question) {
      throw new Error('Respuesta inválida: la pregunta no pertenece a esta partida');
    }
    if (seen.has(submitted.questionId)) {
      throw new Error('Respuesta inválida: pregunta respondida más de una vez');
    }
    seen.add(submitted.questionId);

    const duration = answerTimeSeconds;

    let timeRemaining = Math.max(0, submitted.timeRemaining);
    if (timeRemaining > duration) {
      if (focusAllowance > 0) {
        focusAllowance -= 1;
        timeRemaining = Math.min(timeRemaining, duration + focusBonus);
      } else {
        timeRemaining = duration;
      }
    }
    const scoringTime = timeRemaining;

    let questionPoints = 0;
    let isCorrect = false;
    let distanceBucket: string | undefined;

    if (question.category === 'MAP') {
      if (!submitted.mapAnswer || question.latitude == null || question.longitude == null) {
        details.push({ questionId: submitted.questionId, isCorrect: false, points: 0, timeRemaining });
        continue;
      }
      const distanceKm = haversineDistance(
        submitted.mapAnswer.lat,
        submitted.mapAnswer.lng,
        question.latitude,
        question.longitude
      );
      if (distanceKm < MAP_CORRECT_THRESHOLD_KM) {
        isCorrect = true;
        const accuracyFactor = Math.max(0, 1 - distanceKm / MAP_MAX_DISTANCE_KM);
        const accuracyPoints = Math.round(config.game.basePoints * accuracyFactor);
        const timePoints = Math.round(
          (scoringTime / answerTimeSeconds) * config.game.maxTimeBonus * accuracyFactor
        );
        questionPoints = accuracyPoints + timePoints;
      }
      if (distanceKm < 100) distanceBucket = '<100km';
      else if (distanceKm < 500) distanceBucket = '100-500km';
      else if (distanceKm < 1000) distanceBucket = '500-1000km';
      else if (distanceKm < 2000) distanceBucket = '1000-2000km';
      else distanceBucket = '>2000km';
    } else if (submitted.answer && submitted.answer === question.correctAnswer) {
      isCorrect = true;
      questionPoints =
        config.game.basePoints +
        Math.round((scoringTime / answerTimeSeconds) * config.game.maxTimeBonus);
    }

    score += questionPoints;
    if (isCorrect) correctCount++;
    details.push({
      questionId: submitted.questionId,
      isCorrect,
      points: questionPoints,
      timeRemaining,
      distanceBucket,
    });
  }

  for (const question of questions) {
    if (!seen.has(question.id)) {
      details.push({ questionId: question.id, isCorrect: false, points: 0, timeRemaining: 0 });
    }
  }

  return { score, correctCount, details };
}
