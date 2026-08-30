import { describe, expect, it } from 'vitest';
import en from '../i18n/en.json';
import es from '../i18n/es.json';

describe('common translations', () => {
  it('provides the Passport general filter label in supported languages', () => {
    expect(es.common.all).toBe('Todos');
    expect(en.common.all).toBe('All');
  });
});
