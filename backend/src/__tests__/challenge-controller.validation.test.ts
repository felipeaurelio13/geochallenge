import { describe, expect, it } from 'vitest';
import { createChallengeSchema } from '../controllers/challenge.controller';

describe('createChallengeSchema', () => {
  it('acepta categorías en minúsculas y normaliza payload numérico en string', () => {
    const result = createChallengeSchema.parse({
      categories: ['map', 'flag'],
      maxPlayers: '4',
      answerTimeSeconds: '20',
    });

    expect(result).toEqual({
      categories: ['MAP', 'FLAG'],
      maxPlayers: 4,
      answerTimeSeconds: 20,
    });
  });

  it('rechaza tiempos fuera de configuración permitida', () => {
    expect(() =>
      createChallengeSchema.parse({
        categories: ['mixed'],
        maxPlayers: '3',
        answerTimeSeconds: '25',
      })
    ).toThrow();
  });

  it('rechaza colecciones excesivas de categorías (mitigación Zod memory exhaustion)', () => {
    const elevenCategories = Array.from({ length: 11 }, () => 'flag');
    expect(() =>
      createChallengeSchema.parse({
        categories: elevenCategories,
        maxPlayers: '4',
        answerTimeSeconds: '20',
      })
    ).toThrow();
  });
});
