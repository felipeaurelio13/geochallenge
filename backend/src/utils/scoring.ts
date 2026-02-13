import { config } from '../config/env.js';

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
