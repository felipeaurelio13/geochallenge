import { describe, expect, it } from 'vitest';
import { getSeedCountries, loadCountryCatalog, type CountryRecord } from '../utils/countryCatalog';

interface SeedFlagQuestion {
  category: 'FLAG';
  questionData: string;
  correctAnswer: string;
  imageUrl: string;
  latitude: number;
  longitude: number;
  continent: string;
}

function buildSeedFlagQuestion(country: CountryRecord): SeedFlagQuestion {
  return {
    category: 'FLAG',
    questionData: country.name,
    correctAnswer: country.name,
    imageUrl: `https://flagcdn.com/w320/${country.flag}.png`,
    latitude: country.lat,
    longitude: country.lng,
    continent: country.continent,
  };
}

describe('country catalog integrity', () => {
  const catalog = loadCountryCatalog();

  it('enforces unique iso2 and flag codes across the catalog', () => {
    const iso2Codes = catalog.map((country) => country.iso2.toUpperCase());
    const flagCodes = catalog.map((country) => country.flag.toLowerCase());

    expect(new Set(iso2Codes).size).toBe(iso2Codes.length);
    expect(new Set(flagCodes).size).toBe(flagCodes.length);
  });

  it('requires complete fields and valid latitude/longitude ranges', () => {
    for (const country of catalog) {
      expect(country.iso2).toMatch(/^[A-Z]{2}$/);
      expect(country.flag).toMatch(/^[a-z]{2}$/);
      expect(country.name.trim().length).toBeGreaterThan(0);
      expect(country.capital.trim().length).toBeGreaterThan(0);
      expect(country.continent.trim().length).toBeGreaterThan(0);
      expect(country.lat).toBeGreaterThanOrEqual(-90);
      expect(country.lat).toBeLessThanOrEqual(90);
      expect(country.lng).toBeGreaterThanOrEqual(-180);
      expect(country.lng).toBeLessThanOrEqual(180);
    }
  });

  it('builds a valid FLAG seed question contract for every active country', () => {
    const activeCountries = getSeedCountries(catalog, true).countries;

    for (const country of activeCountries) {
      const seedQuestion = buildSeedFlagQuestion(country);

      expect(seedQuestion.category).toBe('FLAG');
      expect(seedQuestion.questionData).toBe(country.name);
      expect(seedQuestion.correctAnswer).toBe(country.name);
      expect(seedQuestion.latitude).toBe(country.lat);
      expect(seedQuestion.longitude).toBe(country.lng);
      expect(seedQuestion.continent).toBe(country.continent);
      expect(seedQuestion.imageUrl).toMatch(/^https:\/\/flagcdn\.com\/w320\/[a-z]{2}\.png$/);
      expect(seedQuestion.imageUrl).toContain(`/${country.flag}.png`);
    }
  });

  it('includes a newly added active stable country in the seed pool without mutating existing entries', () => {
    const baseSelection = getSeedCountries(catalog, false);
    const existingNames = new Set(baseSelection.countries.map((country) => country.name));

    const newCountry: CountryRecord = {
      iso2: 'ZZ',
      name: 'Testland',
      capital: 'Test City',
      continent: 'Test Continent',
      lat: 10,
      lng: 20,
      flag: 'zz',
      status: 'active',
      rollout: 'stable',
    };

    const augmentedSelection = getSeedCountries([...catalog, newCountry], false);

    expect(augmentedSelection.countries).toHaveLength(baseSelection.countries.length + 1);
    expect(augmentedSelection.countries.some((country) => country.name === newCountry.name)).toBe(true);

    for (const countryName of existingNames) {
      expect(augmentedSelection.countries.some((country) => country.name === countryName)).toBe(true);
    }
  });
});
