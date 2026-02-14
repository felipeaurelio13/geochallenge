import { describe, expect, it } from 'vitest';
import { shouldAutoCloseQuestion, shouldResolveQuestion } from '../sockets/duel.utils.js';

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


  it('no auto-cierra si la pregunta ya está en proceso de resolución', () => {
    expect(shouldAutoCloseQuestion('playing', 2, 2, 2)).toBe(false);
  });

  it('solo resuelve una vez la pregunta activa', () => {
    expect(shouldResolveQuestion('playing', 3, 3, undefined)).toBe(true);
    expect(shouldResolveQuestion('playing', 3, 3, 3)).toBe(false);
    expect(shouldResolveQuestion('playing', 2, 3, undefined)).toBe(false);
  });

});
