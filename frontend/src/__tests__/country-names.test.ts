import { describe, expect, it } from 'vitest';
import { getLocalizedCountryName } from '../utils/countryNames';

describe('getLocalizedCountryName', () => {
  it('uses the active language to format ISO country names', () => {
    expect(getLocalizedCountryName('CI', 'es', 'Ivory Coast')).toBe('Costa de Marfil');
    expect(getLocalizedCountryName('CI', 'en', "Côte d’Ivoire")).toBe("Côte d’Ivoire");
  });

  it('preserves the supplied text when there is no usable country code', () => {
    expect(getLocalizedCountryName(null, 'es', 'Ivory Coast')).toBe('Ivory Coast');
    expect(getLocalizedCountryName('invalid', 'en', 'Ivory Coast')).toBe('Ivory Coast');
  });
});
