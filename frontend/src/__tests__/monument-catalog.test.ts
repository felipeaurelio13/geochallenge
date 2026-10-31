import { describe, expect, it } from 'vitest';
import {
  monuments,
  getMonumentBySlug,
  getMonumentByEnName,
  getLocalizedMonumentName,
  resolveLanguage,
  parseMonumentQuestionData,
} from '../data/monuments';

describe('monuments catalog', () => {
  it('loads all monuments and contains newly added landmarks', () => {
    expect(monuments.length).toBeGreaterThanOrEqual(120);

    for (const slug of [
      'himeji-castle',
      'charles-bridge',
      'chillon-castle',
      'schonbrunn-palace',
      'prambanan',
      'mezquita-cordoba',
    ]) {
      expect(getMonumentBySlug(slug), `${slug} should exist`).toBeDefined();
    }

    const bran = getMonumentBySlug('bran-castle');
    expect(bran).toBeDefined();
    expect(bran?.country).toBe('Romania');
    expect(bran?.continent).toBe('Europe');
    expect(bran?.difficulty).toBe('MEDIUM');

    const trevi = getMonumentBySlug('trevi-fountain');
    expect(trevi).toBeDefined();
    expect(trevi?.country).toBe('Italy');
    expect(trevi?.continent).toBe('Europe');
    expect(trevi?.difficulty).toBe('EASY');

    const gateway = getMonumentBySlug('gateway-of-india');
    expect(gateway).toBeDefined();
    expect(gateway?.country).toBe('India');
    expect(gateway?.continent).toBe('Asia');
    expect(gateway?.difficulty).toBe('MEDIUM');

    const pena = getMonumentBySlug('pena-palace');
    expect(pena).toBeDefined();
    expect(pena?.country).toBe('Portugal');
    expect(pena?.continent).toBe('Europe');
    expect(pena?.difficulty).toBe('EASY');

    const pamukkale = getMonumentBySlug('pamukkale');
    expect(pamukkale).toBeDefined();
    expect(pamukkale?.country).toBe('Turkey');
    expect(pamukkale?.continent).toBe('Asia');
    expect(pamukkale?.difficulty).toBe('EASY');

    const preikestolen = getMonumentBySlug('preikestolen');
    expect(preikestolen).toBeDefined();
    expect(preikestolen?.country).toBe('Norway');
    expect(preikestolen?.continent).toBe('Europe');
    expect(preikestolen?.difficulty).toBe('MEDIUM');
  });

  it('lookups by English name are case-insensitive', () => {
    const pena = getMonumentByEnName('pena palace');
    expect(pena?.slug).toBe('pena-palace');

    const pamukkale = getMonumentByEnName('Pamukkale');
    expect(pamukkale?.slug).toBe('pamukkale');

    expect(getMonumentByEnName('')).toBeUndefined();
  });

  it('localizes monument names correctly with fallbacks', () => {
    expect(getLocalizedMonumentName('pena-palace', 'es')).toBe('Palacio da Pena');
    expect(getLocalizedMonumentName('pena-palace', 'en')).toBe('Pena Palace');
    expect(getLocalizedMonumentName('unknown-slug', 'es')).toBeUndefined();
  });

  it('resolves language with fallback to es', () => {
    expect(resolveLanguage('en')).toBe('en');
    expect(resolveLanguage('en-US')).toBe('en');
    expect(resolveLanguage('es')).toBe('es');
    expect(resolveLanguage('fr')).toBe('es');
    expect(resolveLanguage(null)).toBe('es');
  });

  it('parses monument question data payload', () => {
    expect(parseMonumentQuestionData(JSON.stringify({ slug: 'pena-palace', variant: 'identify' }))).toEqual({
      slug: 'pena-palace',
      variant: 'identify',
    });
    expect(parseMonumentQuestionData(JSON.stringify({ slug: 'preikestolen', variant: 'country' }))).toEqual({
      slug: 'preikestolen',
      variant: 'country',
    });
    expect(parseMonumentQuestionData(null)).toBeNull();
    expect(parseMonumentQuestionData('not-json')).toBeNull();
    expect(parseMonumentQuestionData(JSON.stringify({ slug: 123 }))).toBeNull();
    expect(parseMonumentQuestionData(JSON.stringify({ slug: 'x', variant: 'other' }))).toBeNull();
  });
});
