import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { haversineDistance } from '../utils/haversine.js';

const DATA_DIR = join(__dirname, '../../../data');

function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8')) as T;
}

interface Country {
  name: string;
  capital: string;
  continent: string;
  lat: number;
  lng: number;
  flag: string;
}
interface CatalogCountry extends Country {
  iso2: string;
}
interface GeoChallengeCountry {
  iso2: string;
  iso3: string;
  nameEn: string;
  capital: string;
  capitalLat: number;
  capitalLng: number;
}
interface City {
  name: string;
  country: string;
  lat: number;
  lng: number;
}
interface Monument {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
}

const countries = loadJson<{ countries: Country[] }>('countries.json').countries;
const cities = loadJson<{ cities: City[] }>('cities.json').cities;
const monuments = loadJson<{ monuments: Monument[] }>('monuments.json').monuments;
const catalog = loadJson<{ countries: CatalogCountry[] }>('country-catalog.v1.json').countries;
const geoCatalog = loadJson<{ countries: GeoChallengeCountry[] }>(
  'geo-challenge-catalog.v1.json'
).countries;

const MAX_CAPITAL_DRIFT_KM = 50;

const validLat = (v: unknown) => typeof v === 'number' && v >= -90 && v <= 90;
const validLng = (v: unknown) => typeof v === 'number' && v >= -180 && v <= 180;

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) dups.add(value);
    seen.add(value);
  }
  return [...dups];
}

describe('data integrity', () => {
  describe('uniqueness', () => {
    it('countries.json has no duplicate names or flag codes', () => {
      expect(duplicates(countries.map((c) => c.name))).toEqual([]);
      expect(duplicates(countries.map((c) => c.flag))).toEqual([]);
    });

    it('country-catalog has no duplicate names or iso2 codes', () => {
      expect(duplicates(catalog.map((c) => c.name))).toEqual([]);
      expect(duplicates(catalog.map((c) => c.iso2))).toEqual([]);
    });

    it('geo-challenge-catalog has no duplicate names, iso2 or iso3 codes', () => {
      expect(duplicates(geoCatalog.map((c) => c.nameEn))).toEqual([]);
      expect(duplicates(geoCatalog.map((c) => c.iso2))).toEqual([]);
      expect(duplicates(geoCatalog.map((c) => c.iso3))).toEqual([]);
    });

    it('cities.json has no duplicate (name, country) pairs', () => {
      expect(duplicates(cities.map((c) => `${c.name}|${c.country}`))).toEqual([]);
    });
  });

  describe('coordinate ranges', () => {
    it('countries.json', () => {
      const bad = countries.filter((c) => !validLat(c.lat) || !validLng(c.lng));
      expect(bad.map((c) => c.name)).toEqual([]);
    });

    it('cities.json', () => {
      const bad = cities.filter((c) => !validLat(c.lat) || !validLng(c.lng));
      expect(bad.map((c) => c.name)).toEqual([]);
    });

    it('monuments.json', () => {
      expect(monuments.length).toBeGreaterThan(0);
      const bad = monuments.filter((m) => {
        const lat = m.lat ?? m.latitude;
        const lng = m.lng ?? m.longitude;
        return !validLat(lat) || !validLng(lng);
      });
      expect(bad).toEqual([]);
    });

    it('country-catalog', () => {
      const bad = catalog.filter((c) => !validLat(c.lat) || !validLng(c.lng));
      expect(bad.map((c) => c.name)).toEqual([]);
    });

    it('geo-challenge-catalog capitals', () => {
      const bad = geoCatalog.filter((c) => !validLat(c.capitalLat) || !validLng(c.capitalLng));
      expect(bad.map((c) => c.nameEn)).toEqual([]);
    });
  });

  describe('capitals', () => {
    it('every country capital exists in cities.json', () => {
      const cityKeys = new Set(cities.map((c) => `${c.name}|${c.country}`));
      const missing = countries
        .filter((c) => !cityKeys.has(`${c.capital}|${c.name}`))
        .map((c) => `${c.capital} (${c.name})`);
      expect(missing).toEqual([]);
    });
  });

  describe('cross-file consistency', () => {
    const countryByName = new Map(countries.map((c) => [c.name, c]));

    it('country-catalog and countries.json list the same countries and capitals', () => {
      expect(catalog.map((c) => c.name).sort()).toEqual(countries.map((c) => c.name).sort());
      const mismatched = catalog
        .filter((c) => countryByName.get(c.name)?.capital !== c.capital)
        .map((c) => c.name);
      expect(mismatched).toEqual([]);
    });

    it('geo-challenge-catalog and countries.json list the same countries and capitals', () => {
      expect(geoCatalog.map((c) => c.nameEn).sort()).toEqual(countries.map((c) => c.name).sort());
      const mismatched = geoCatalog
        .filter((c) => countryByName.get(c.nameEn)?.capital !== c.capital)
        .map((c) => c.nameEn);
      expect(mismatched).toEqual([]);
    });

    it('geo-challenge-catalog and country-catalog share iso2 codes per country', () => {
      const catalogIso = new Map(catalog.map((c) => [c.name, c.iso2]));
      const mismatched = geoCatalog
        .filter((c) => catalogIso.get(c.nameEn) !== c.iso2)
        .map((c) => c.nameEn);
      expect(mismatched).toEqual([]);
    });

    it(`geo-challenge-catalog capital coordinates are within ${MAX_CAPITAL_DRIFT_KM} km of countries.json`, () => {
      const drifted = geoCatalog
        .map((c) => {
          const canonical = countryByName.get(c.nameEn);
          const km = canonical
            ? haversineDistance(c.capitalLat, c.capitalLng, canonical.lat, canonical.lng)
            : Infinity;
          return { name: c.nameEn, km: Math.round(km) };
        })
        .filter((c) => c.km > MAX_CAPITAL_DRIFT_KM);
      expect(drifted).toEqual([]);
    });
  });
});
