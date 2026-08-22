/**
 * Timing server-authoritative para scoring.
 *
 * El servidor calcula el tiempo efectivo restante a partir del instante en que
 * la pregunta fue emitida (startedAtMs) y su duración, ignorando cualquier
 * timeRemaining que el cliente envíe. El resultado queda acotado por
 * [0, durationMs] y se devuelve en segundos (la unidad que usa el scoring).
 *
 * La ventana de bonus es siempre la duración base del modo (config.game.timePerQuestion).
 * Un timer de pantalla más largo (p.ej. extended-time)
 * da más tiempo para leer/responder, pero nunca infla el bonus más allá de la
 * duración base — consistente con el clamp que ya aplicaba el frontend.
 */
export function effectiveTimeRemainingSeconds(
  startedAtMs: number,
  durationMs: number,
  nowMs: number = Date.now()
): number {
  if (!Number.isFinite(startedAtMs) || durationMs <= 0) {
    return 0;
  }
  const deadlineMs = startedAtMs + durationMs;
  const remainingMs = Math.min(Math.max(deadlineMs - nowMs, 0), durationMs);
  return remainingMs / 1000;
}
