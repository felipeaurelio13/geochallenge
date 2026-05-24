import { describe, it, expect } from 'vitest';
import { validateCinemaGeoQuestion, type CinemaGeoQuestion } from '../scripts/validate-cinema-geo.js';

// Re-export the validation function for tests
// (validate-cinema-geo.ts exports validateCinemaGeoQuestion)

function makeValid(overrides: Partial<CinemaGeoQuestion> = {}): CinemaGeoQuestion {
  return {
    id: 'test-question-001',
    type: 'film_from_iconic_set',
    difficulty: 'MEDIUM',
    prompt: { es: '¿En qué película aparece esta locación?', en: 'In which film does this location appear?' },
    correctAnswer: 'The Matrix',
    options: ['The Matrix', 'Dark City', 'Equilibrium', 'Tron'],
    movie: { title: 'The Matrix', year: 1999 },
    geoContext: { realLocation: 'Sydney', city: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093, continent: 'Oceania' },
    visual: {
      strategy: 'movie_card',
      alt: { es: 'Tarjeta de The Matrix', en: 'The Matrix card' },
      hintsLevel: 'medium',
    },
    sourceClaims: [{ claim: 'The Matrix was filmed in Sydney.', sourceUrl: 'https://example.com/source' }],
    confidence: 'high',
    reviewStatus: 'approved',
    ...overrides,
  };
}

describe('validateCinemaGeoQuestion', () => {
  it('passes a well-formed approved question', () => {
    expect(validateCinemaGeoQuestion(makeValid())).toEqual([]);
  });

  it('errors when type is invalid', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ type: 'invalid_type' as never }));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/tipo inválido/);
  });

  it('errors when difficulty is invalid', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ difficulty: 'EXTREME' as never }));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/dificultad inválida/);
  });

  it('errors when reviewStatus is invalid', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ reviewStatus: 'pending' as never }));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/reviewStatus inválido/);
  });

  it('errors when confidence is invalid', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ confidence: 'very_high' as never }));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/confidence inválida/);
  });

  it('errors when prompt.es is empty', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ prompt: { es: '', en: 'Some question?' } }));
    expect(errors.some((e) => e.includes('prompt.es'))).toBe(true);
  });

  it('errors when prompt.en is empty', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ prompt: { es: '¿Pregunta?', en: '' } }));
    expect(errors.some((e) => e.includes('prompt.en'))).toBe(true);
  });

  it('errors when correctAnswer is not in options', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ correctAnswer: 'Inception' }));
    expect(errors.some((e) => e.includes('correctAnswer'))).toBe(true);
  });

  it('errors when options has duplicates', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ options: ['The Matrix', 'The Matrix', 'Dark City', 'Tron'] }));
    expect(errors.some((e) => e.includes('duplicados'))).toBe(true);
  });

  it('errors when options count != 4', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ options: ['The Matrix', 'Dark City', 'Tron'] }));
    expect(errors.some((e) => e.includes('4 elementos'))).toBe(true);
  });

  it('errors when approved question has no sourceClaims', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ sourceClaims: undefined }));
    expect(errors.some((e) => e.includes('sourceClaims'))).toBe(true);
  });

  it('errors when approved question has empty sourceClaims array', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ sourceClaims: [] }));
    expect(errors.some((e) => e.includes('sourceClaims'))).toBe(true);
  });

  it('errors when approved question has sourceClaims but all with empty sourceUrl', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ sourceClaims: [{ claim: 'Some claim', sourceUrl: '' }] }));
    expect(errors.some((e) => e.includes('sourceUrl real'))).toBe(true);
  });

  it('does NOT error for needs_sources question even without real sourceUrl', () => {
    const q = makeValid({ reviewStatus: 'needs_sources', sourceClaims: [{ claim: 'Claim', sourceUrl: '' }] });
    const errors = validateCinemaGeoQuestion(q);
    expect(errors).toEqual([]);
  });

  it('errors when geoContext.lat is out of range', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ geoContext: { lat: 95, lng: 0 } }));
    expect(errors.some((e) => e.includes('lat inválido'))).toBe(true);
  });

  it('errors when geoContext.lng is out of range', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ geoContext: { lat: 0, lng: 200 } }));
    expect(errors.some((e) => e.includes('lng inválido'))).toBe(true);
  });

  it('errors when visual.strategy is invalid', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ visual: { strategy: 'poster' as never } }));
    expect(errors.some((e) => e.includes('visual.strategy inválida'))).toBe(true);
  });

  it('passes when visual.strategy is none with no alt (alt not required for none)', () => {
    const q = makeValid({ visual: { strategy: 'none' }, reviewStatus: 'needs_sources', sourceClaims: [] });
    const errors = validateCinemaGeoQuestion(q);
    expect(errors.filter((e) => e.includes('visual.alt'))).toHaveLength(0);
  });

  it('passes when visual.strategy is movie_card with no url (CSS-only card)', () => {
    const q = makeValid({
      visual: { strategy: 'movie_card', alt: { es: 'Tarjeta', en: 'Card' } },
    });
    const errors = validateCinemaGeoQuestion(q);
    expect(errors).toEqual([]);
  });

  it('errors when visual.alt is missing for non-none strategy', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ visual: { strategy: 'movie_card' } }));
    expect(errors.some((e) => e.includes('visual.alt'))).toBe(true);
  });

  it('errors when movie_from_filming_map has no mapPins', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ type: 'movie_from_filming_map', mapPins: [] }));
    expect(errors.some((e) => e.includes('mapPins'))).toBe(true);
  });

  it('passes a needs_sources question with no sourceClaims', () => {
    const q = makeValid({ reviewStatus: 'needs_sources', sourceClaims: undefined });
    const errors = validateCinemaGeoQuestion(q);
    expect(errors).toEqual([]);
  });
});
