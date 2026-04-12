import { readFileSync } from 'fs';
import { join } from 'path';

export type CountryStatus = 'active' | 'pending_review' | 'disabled';

export interface CountryRecord {
  iso2: string;
  name: string;
  capital: string;
  continent: string;
  lat: number;
  lng: number;
  flag: string;
  status: CountryStatus;
  rollout?: 'stable' | 'extended';
}

interface CountryCatalogV1 {
  version: 'v1';
  countries: CountryRecord[];
}

interface LegacyCountriesPayload {
  countries: Array<Omit<CountryRecord, 'iso2' | 'status'>>;
}

const CATALOG_PATH = join(__dirname, '../../../data/country-catalog.v1.json');
const LEGACY_PATH = join(__dirname, '../../../data/countries.json');

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
}

export function loadCountryCatalog(): CountryRecord[] {
  try {
    const payload = readJsonFile<CountryCatalogV1>(CATALOG_PATH);
    if (payload.version !== 'v1' || !Array.isArray(payload.countries)) {
      throw new Error('Formato inválido en country-catalog.v1.json');
    }
    return payload.countries;
  } catch (error) {
    console.warn('⚠️  No se pudo cargar country-catalog.v1.json. Usando fallback countries.json');
    const fallback = readJsonFile<LegacyCountriesPayload>(LEGACY_PATH);
    return fallback.countries.map((country) => ({
      iso2: country.flag.toUpperCase(),
      ...country,
      status: 'active',
    }));
  }
}

export function getActiveCountries(countries: CountryRecord[]): CountryRecord[] {
  return countries.filter((country) => country.status === 'active');
}

export interface SeedCountrySelection {
  countries: CountryRecord[];
  totalActiveCountries: number;
  extendedCountriesIncluded: number;
  extendedCountriesExcluded: number;
}

function isExtendedCountry(country: CountryRecord): boolean {
  return country.rollout === 'extended';
}

export function getSeedCountries(
  countries: CountryRecord[],
  enableExtendedFlags: boolean
): SeedCountrySelection {
  const activeCountries = getActiveCountries(countries);
  const extendedActiveCountries = activeCountries.filter(isExtendedCountry);

  if (enableExtendedFlags) {
    return {
      countries: activeCountries,
      totalActiveCountries: activeCountries.length,
      extendedCountriesIncluded: extendedActiveCountries.length,
      extendedCountriesExcluded: 0,
    };
  }

  const stableCountries = activeCountries.filter((country) => !isExtendedCountry(country));

  return {
    countries: stableCountries,
    totalActiveCountries: activeCountries.length,
    extendedCountriesIncluded: 0,
    extendedCountriesExcluded: extendedActiveCountries.length,
  };
}
