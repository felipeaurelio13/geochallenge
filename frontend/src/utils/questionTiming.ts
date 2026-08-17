/**
 * Per-category timing rules.
 */
import type { Category } from '../types';

/**
 * Extended-time accommodation (a11y phase 2, single-player only): the
 * `extendedTimeEnabled` user preference (see useUiStore.ts) multiplies the
 * question's time budget by this factor. Intentionally NOT applied to
 * Duel/Survival — those are competitive PvP modes and must stay fair for
 * every player.
 */
export const EXTENDED_TIME_MULTIPLIER = 1.5;

/** Total seconds shown to the player for this category (timer starts here, counts down). */
export function getQuestionDuration(category: Category | undefined, baseDuration: number): number {
  return baseDuration;
}

/**
 * Applies the extended-time accommodation multiplier on top of an already
 * category-adjusted duration (i.e. call this with the result of
 * getQuestionDuration, not the raw base duration). Rounded up so the player
 * never gets less than a whole extra second from the accommodation.
 */
export function applyExtendedTime(duration: number, extendedTimeEnabled: boolean): number {
  if (!extendedTimeEnabled) return duration;
  return Math.ceil(duration * EXTENDED_TIME_MULTIPLIER);
}

/**
 * Clamp the timeRemaining the client reports to the backend so the bonus window stays
 * fair across categories, and so it never exceeds what the backend's Zod schema accepts
 * (`z.number().min(0).max(config.game.timePerQuestion)` — see game.controller.ts).
 *
 * This also caps the case where the extended-time accommodation (applyExtendedTime)
 * lets the on-screen timer run longer than baseDuration: without this clamp, a player
 * with extended time could report a timeRemaining above what the backend allows,
 * causing the request to be rejected.
 */
export function clampTimeRemainingForScoring(
  _category: Category | undefined,
  timeRemaining: number,
  baseDuration: number,
): number {
  return Math.max(0, Math.min(baseDuration, timeRemaining));
}
