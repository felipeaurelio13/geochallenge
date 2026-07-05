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
  if (category === 'CINEMA_GEO') return baseDuration + CINEMA_GEO_EXTRA_READ_SECONDS;
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
 * (`z.number().min(0).max(config.game.timePerQuestion)` — see game.controller.ts). The
 * first CINEMA_GEO_EXTRA_READ_SECONDS are "free read time" and never contribute to the
 * time bonus.
 *
 * This also caps the case where the extended-time accommodation (applyExtendedTime)
 * lets the on-screen timer run longer than baseDuration: without this clamp, a player
 * with extended time could report a timeRemaining above what the backend allows,
 * causing the request to be rejected (or, for CINEMA_GEO where a bare max() was used
 * before, inflating the time bonus beyond its intended cap).
 */
export function clampTimeRemainingForScoring(
  _category: Category | undefined,
  timeRemaining: number,
  baseDuration: number,
): number {
  return Math.max(0, Math.min(baseDuration, timeRemaining));
}
