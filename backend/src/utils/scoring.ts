import { config } from '../config/env.js';

const MAP_MAX_DISTANCE_KM = 2000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Calcula el bonus de tiempo basado en cuánto tiempo quedaba
 * @param timeRemaining Tiempo restante en segundos
 * @param totalTime Tiempo total por pregunta (default: 10)
 * @returns Bonus de puntos (0 - maxTimeBonus)
 */
export function calculateTimeBonus(
  timeRemaining: number,
  totalTime: number = config.game.timePerQuestion
): number {
  if (timeRemaining <= 0) return 0;
  const ratio = timeRemaining / totalTime;
  return Math.floor(ratio * config.game.maxTimeBonus);
}

/**
 * Calcula el puntaje total para una respuesta correcta
 * @param isCorrect Si la respuesta fue correcta
 * @param timeRemaining Tiempo restante en segundos
 * @returns Puntaje total
 */
export function calculateScore(isCorrect: boolean, timeRemaining: number): number {
  if (!isCorrect) return 0;
  return config.game.basePoints + calculateTimeBonus(timeRemaining);
}

/**
 * Puntaje para preguntas de mapa, combinando precisión + velocidad
 */
export function calculateMapScore(
  distanceKm: number,
  timeRemaining: number,
  maxDistanceKm: number = MAP_MAX_DISTANCE_KM
): number {
  if (distanceKm >= maxDistanceKm) return 0;

  const clampedDistance = clamp(distanceKm, 0, maxDistanceKm);
  const accuracyFactor = 1 - clampedDistance / maxDistanceKm;

  const accuracyPoints = Math.round(config.game.basePoints * accuracyFactor);
  const timePoints = Math.round(calculateTimeBonus(timeRemaining) * accuracyFactor);

  return accuracyPoints + timePoints;
}

/**
 * Mezcla un array aleatoriamente (Fisher-Yates)
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Selecciona N elementos aleatorios de un array
 */
export function selectRandom<T>(array: T[], count: number): T[] {
  const shuffled = shuffleArray(array);
  return shuffled.slice(0, Math.min(count, array.length));
}
