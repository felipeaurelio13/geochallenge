import { describe, expect, it } from 'vitest';
import { normalizeEmail, normalizeUsername } from '../utils/authNormalization.js';

describe('auth normalization', () => {
  it('normalizes email trimming spaces and lowercasing to avoid login failures', () => {
    expect(normalizeEmail('  User.Name+test@Example.COM  ')).toBe('user.name+test@example.com');
  });

  it('normalizes username trimming accidental spaces', () => {
    expect(normalizeUsername('  GeoMaster2024  ')).toBe('GeoMaster2024');
  });
});
