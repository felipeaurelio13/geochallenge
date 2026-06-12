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
const CINEMA_GEO_EXTRA_READ_SECONDS = 5;

export function evaluateTimedAnswers(
  questions: EvaluableQuestion[],
  answers: SubmittedAnswer[],
  answerTimeSeconds: number
): { score: number; correctCount: number } {
  if (answers.length > questions.length) {
    throw new Error('Respuestas inválidas: más respuestas que preguntas');
  }

  const byId = new Map(questions.map((q) => [q.id, q]));
  const seen = new Set<string>();
  // Focus Time (+Ns) se usa a lo más una vez por partida: permitimos un solo
  // timeRemaining por encima de la duración de la ronda y recortamos el resto.
  let focusAllowance = 1;
  const focusBonus = config.game.mechanics.focusTimeBonusSeconds;

  let score = 0;
  let correctCount = 0;

  for (const submitted of answers) {
    const question = byId.get(submitted.questionId);
    if (!question) {
      throw new Error('Respuesta inválida: la pregunta no pertenece a esta partida');
    }
    if (seen.has(submitted.questionId)) {
      throw new Error('Respuesta inválida: pregunta respondida más de una vez');
    }
    seen.add(submitted.questionId);

    const extraRead = question.category === 'CINEMA_GEO' ? CINEMA_GEO_EXTRA_READ_SECONDS : 0;
    const duration = answerTimeSeconds + extraRead;

    let timeRemaining = Math.max(0, submitted.timeRemaining);
    if (timeRemaining > duration) {
      if (focusAllowance > 0) {
        focusAllowance -= 1;
        timeRemaining = Math.min(timeRemaining, duration + focusBonus);
      } else {
        timeRemaining = duration;
      }
    }
    // El tiempo extra de lectura de CINEMA_GEO no infla el bonus (espejo de
    // clampTimeRemainingForScoring en el cliente).
    const scoringTime =
      question.category === 'CINEMA_GEO' ? Math.min(timeRemaining, answerTimeSeconds) : timeRemaining;

    if (question.category === 'MAP') {
      if (!submitted.mapAnswer || question.latitude == null || question.longitude == null) {
        continue;
      }
      const distanceKm = haversineDistance(
        submitted.mapAnswer.lat,
        submitted.mapAnswer.lng,
        question.latitude,
        question.longitude
      );
      if (distanceKm < MAP_CORRECT_THRESHOLD_KM) {
        correctCount += 1;
        const accuracyFactor = Math.max(0, 1 - distanceKm / MAP_MAX_DISTANCE_KM);
        const accuracyPoints = Math.round(config.game.basePoints * accuracyFactor);
        const timePoints = Math.round(
          (scoringTime / answerTimeSeconds) * config.game.maxTimeBonus * accuracyFactor
        );
        score += accuracyPoints + timePoints;
      }
    } else if (submitted.answer && submitted.answer === question.correctAnswer) {
      correctCount += 1;
      score +=
        config.game.basePoints +
        Math.round((scoringTime / answerTimeSeconds) * config.game.maxTimeBonus);
    }
  }

  return { score, correctCount };
}
