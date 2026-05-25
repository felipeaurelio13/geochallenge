import { describe, it, expect } from 'vitest';
import { validateCinemaGeoQuestion, type CinemaGeoQuestion } from '../scripts/validate-cinema-geo.js';

function makeValid(overrides: Partial<CinemaGeoQuestion> = {}): CinemaGeoQuestion {
  return {
    id: 'test-question-001',
    answerKind: 'city',
    difficulty: 'MEDIUM',
    prompt: { es: '¿En qué ciudad se filmó esta escena?', en: 'In which city was this scene filmed?' },
    movie: { title: 'The Matrix', year: 1999 },
    answer: {
      value: 'Sydney',
      country: 'Australia',
      city: 'Sydney',
      realLocation: 'Sydney CBD',
      lat: -33.8688,
      lng: 151.2093,
      continent: 'Oceania',
    },
    options: ['Sydney', 'Melbourne', 'Brisbane', 'Auckland'],
    sources: [{ claim: 'The Matrix was filmed in Sydney.', sourceUrl: 'https://example.com/source' }],
    confidence: 'high',
    reviewStatus: 'approved',
    ...overrides,
  };
}

describe('validateCinemaGeoQuestion (v2)', () => {
  it('passes a well-formed approved question', () => {
    expect(validateCinemaGeoQuestion(makeValid())).toEqual([]);
  });

  it('errors when answerKind is invalid', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ answerKind: 'planet' as never }));
    expect(errors.some((e) => e.includes('answerKind'))).toBe(true);
  });

  it('errors when difficulty is invalid', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ difficulty: 'EXTREME' as never }));
    expect(errors.some((e) => e.includes('dificultad'))).toBe(true);
  });

  it('errors when reviewStatus is invalid', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ reviewStatus: 'pending' as never }));
    expect(errors.some((e) => e.includes('reviewStatus'))).toBe(true);
  });

  it('errors when confidence is invalid', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ confidence: 'extreme' as never }));
    expect(errors.some((e) => e.includes('confidence'))).toBe(true);
  });

  it('errors when prompt.es is empty', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ prompt: { es: '', en: 'Question?' } }));
    expect(errors.some((e) => e.includes('prompt.es'))).toBe(true);
  });

  it('errors when prompt.en is empty', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ prompt: { es: '¿Pregunta?', en: '' } }));
    expect(errors.some((e) => e.includes('prompt.en'))).toBe(true);
  });

  it('errors when answer.value equals movie title (spoiler)', () => {
    const errors = validateCinemaGeoQuestion(
      makeValid({
        answer: { value: 'The Matrix', country: 'Australia', city: 'Sydney' },
        options: ['The Matrix', 'Dark City', 'Equilibrium', 'Tron'],
      }),
    );
    expect(errors.some((e) => /SPOILER/.test(e))).toBe(true);
  });

  it('errors when answer.value is not in options', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ answer: { value: 'Perth' } }));
    expect(errors.some((e) => e.includes('answer.value'))).toBe(true);
  });

  it('errors when options has duplicates', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ options: ['Sydney', 'Sydney', 'Brisbane', 'Auckland'] }));
    expect(errors.some((e) => e.includes('duplicados'))).toBe(true);
  });

  it('errors when options count != 4', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ options: ['Sydney', 'Brisbane', 'Auckland'] }));
    expect(errors.some((e) => e.includes('4 elementos'))).toBe(true);
  });

  it('errors when approved has no sources', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ sources: [] }));
    expect(errors.some((e) => e.includes('sources'))).toBe(true);
  });

  it('errors when approved has sources but no real sourceUrl', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ sources: [{ claim: 'X', sourceUrl: '' }] }));
    expect(errors.some((e) => e.includes('sourceUrl'))).toBe(true);
  });

  it('does NOT error for needs_sources without sources', () => {
    const errors = validateCinemaGeoQuestion(
      makeValid({ reviewStatus: 'needs_sources', sources: [] }),
    );
    expect(errors).toEqual([]);
  });

  it('errors when answer.lat is out of range', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ answer: { value: 'Sydney', lat: 95, lng: 0 } }));
    expect(errors.some((e) => e.includes('lat'))).toBe(true);
  });

  it('errors when answer.lng is out of range', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ answer: { value: 'Sydney', lat: 0, lng: 200 } }));
    expect(errors.some((e) => e.includes('lng'))).toBe(true);
  });

  it('errors when id has whitespace', () => {
    const errors = validateCinemaGeoQuestion(makeValid({ id: 'has space' }));
    expect(errors.some((e) => e.includes('id'))).toBe(true);
  });
});
