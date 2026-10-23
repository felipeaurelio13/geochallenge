import { describe, expect, it } from 'vitest';
import {
  monuments,
  getMonumentBySlug,
  getMonumentByEnName,
  getLocalizedMonumentName,
  resolveLanguage,
  parseMonumentQuestionData,
} from '../data/monuments';

describe('monuments catalog and utilities', () => {
  it('loads catalog containing monuments including newly added candidates', () => {
    expect(monuments.length).toBeGreaterThanOrEqual(104);

    const branCastle = getMonumentBySlug('bran-castle');
    expect(branCastle).toBeDefined();
    expect(branCastle?.name.en).toBe('Bran Castle');
    expect(branCastle?.name.es).toBe('Castillo de Bran');
    expect(branCastle?.country).toBe('Romania');
    expect(branCastle?.continent).toBe('Europe');
    expect(branCastle?.difficulty).toBe('MEDIUM');
    expect(branCastle?.attribution.author).toBe('Todor Bozhinov');

    const sigiriya = getMonumentBySlug('sigiriya');
    expect(sigiriya).toBeDefined();
    expect(sigiriya?.name.en).toBe('Sigiriya');
    expect(sigiriya?.name.es).toBe('Sigiriya');
    expect(sigiriya?.country).toBe('Sri Lanka');
    expect(sigiriya?.continent).toBe('Asia');
    expect(sigiriya?.difficulty).toBe('MEDIUM');
    expect(sigiriya?.attribution.author).toBe('Bernard Gagnon');

    const trevi = getMonumentBySlug('trevi-fountain');
    expect(trevi).toBeDefined();
    expect(trevi?.name.en).toBe('Trevi Fountain');
    expect(trevi?.name.es).toBe('Fontana de Trevi');
    expect(trevi?.country).toBe('Italy');
    expect(trevi?.continent).toBe('Europe');
    expect(trevi?.difficulty).toBe('EASY');
    expect(trevi?.attribution.author).toBe('NikonZ7II');
  });

  it('getMonumentBySlug returns undefined for non-existent slugs', () => {
    expect(getMonumentBySlug('non-existent-monument')).toBeUndefined();
    expect(getMonumentBySlug('')).toBeUndefined();
  });

  it('getMonumentByEnName matches case-insensitively', () => {
    const fromLower = getMonumentByEnName('bran castle');
    const fromMixed = getMonumentByEnName('Bran Castle');
    const fromUpper = getMonumentByEnName('BRAN CASTLE');

    expect(fromLower).toBeDefined();
    expect(fromLower?.slug).toBe('bran-castle');
    expect(fromMixed?.slug).toBe('bran-castle');
    expect(fromUpper?.slug).toBe('bran-castle');

    expect(getMonumentByEnName('')).toBeUndefined();
    expect(getMonumentByEnName('unknown landmark')).toBeUndefined();
  });

  it('getLocalizedMonumentName returns localized name or falls back to en', () => {
    expect(getLocalizedMonumentName('trevi-fountain', 'es')).toBe('Fontana de Trevi');
    expect(getLocalizedMonumentName('trevi-fountain', 'en')).toBe('Trevi Fountain');
    expect(getLocalizedMonumentName('non-existent', 'es')).toBeUndefined();
  });

  it('resolveLanguage defaults to es and recognizes English variants', () => {
    expect(resolveLanguage('es')).toBe('es');
    expect(resolveLanguage('en')).toBe('en');
    expect(resolveLanguage('en-US')).toBe('en');
    expect(resolveLanguage('EN')).toBe('en');
    expect(resolveLanguage(null)).toBe('es');
    expect(resolveLanguage(undefined)).toBe('es');
    expect(resolveLanguage('fr')).toBe('es');
  });

  describe('parseMonumentQuestionData', () => {
    it('parses valid identify and country variants', () => {
      const identify = parseMonumentQuestionData(
        JSON.stringify({ slug: 'bran-castle', variant: 'identify' })
      );
      expect(identify).toEqual({ slug: 'bran-castle', variant: 'identify' });

      const country = parseMonumentQuestionData(
        JSON.stringify({ slug: 'sigiriya', variant: 'country' })
      );
      expect(country).toEqual({ slug: 'sigiriya', variant: 'country' });
    });

    it('rejects null, non-strings, or malformed JSON payloads', () => {
      expect(parseMonumentQuestionData(null)).toBeNull();
      expect(parseMonumentQuestionData(undefined)).toBeNull();
      expect(parseMonumentQuestionData({ slug: 'sigiriya', variant: 'country' })).toBeNull();
      expect(parseMonumentQuestionData('not-json')).toBeNull();
      expect(parseMonumentQuestionData(JSON.stringify({ slug: 123, variant: 'identify' }))).toBeNull();
      expect(
        parseMonumentQuestionData(JSON.stringify({ slug: 'bran-castle', variant: 'unknown' }))
      ).toBeNull();
    });
  });
});
