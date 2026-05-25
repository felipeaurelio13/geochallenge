/**
 * Per-category timing rules.
 *
 * CINEMA_GEO prompts read like a sentence ("La icónica escena en que Ethan Hunt escala el
 * Burj Khalifa…") instead of a single phrase ("¿Capital de Francia?"). We give the player
 * EXTRA_READ_SECONDS extra at the top of the round to read, then the base bonus window
 * kicks in. The first EXTRA_READ_SECONDS don't inflate the time bonus because we clamp
 * the value sent to the backend to baseDuration.
 *
 * Result: equity preserved across categories. A player who spent the same "thinking time"
 * (post-read) on a CINEMA_GEO vs a FLAG question gets the same time bonus.
 */
import type { Category } from '../types';

export const CINEMA_GEO_EXTRA_READ_SECONDS = 5;

/** Total seconds shown to the player for this category (timer starts here, counts down). */
export function getQuestionDuration(category: Category | undefined, baseDuration: number): number {
  if (category === 'CINEMA_GEO') return baseDuration + CINEMA_GEO_EXTRA_READ_SECONDS;
  return baseDuration;
}

/**
 * Clamp the timeRemaining the client reports to the backend so the bonus window stays
 * fair across categories. The first CINEMA_GEO_EXTRA_READ_SECONDS are "free read time"
 * and never contribute to the time bonus.
 */
export function clampTimeRemainingForScoring(
  category: Category | undefined,
  timeRemaining: number,
  baseDuration: number,
): number {
  if (category === 'CINEMA_GEO') {
    return Math.max(0, Math.min(baseDuration, timeRemaining));
  }
  return Math.max(0, timeRemaining);
}
