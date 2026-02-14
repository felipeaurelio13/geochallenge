import { describe, expect, it } from 'vitest';
import { shouldAutoCloseQuestion } from '../sockets/duel.utils.js';

describe('duel timeout guard', () => {
  it('auto-cierra solo cuando sigue siendo la misma pregunta en juego', () => {
    expect(shouldAutoCloseQuestion('playing', 0, 0)).toBe(true);
  });

  it('no auto-cierra cuando el duelo ya avanzó a otra pregunta', () => {
    expect(shouldAutoCloseQuestion('playing', 0, 1)).toBe(false);
  });

  it('no auto-cierra si el duelo ya no está en estado playing', () => {
    expect(shouldAutoCloseQuestion('finished', 0, 0)).toBe(false);
    expect(shouldAutoCloseQuestion('countdown', 0, 0)).toBe(false);
  });
});
