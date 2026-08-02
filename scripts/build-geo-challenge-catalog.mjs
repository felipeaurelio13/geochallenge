#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , upstreamArg, outputArg = 'data/geo-challenge-catalog.v1.json'] = process.argv;

if (!upstreamArg) {
  console.error('Uso: node scripts/build-geo-challenge-catalog.mjs <countriesV3.1.json> [salida]');
  process.exit(1);
}

const root = process.cwd();
const upstreamPath = resolve(root, upstreamArg);
const outputPath = resolve(root, outputArg);
const baseCatalog = JSON.parse(
  readFileSync(resolve(root, 'data/country-catalog.v1.json'), 'utf8'),
);
const upstream = JSON.parse(readFileSync(upstreamPath, 'utf8'));

const upstreamByIso2 = new Map(upstream.map((country) => [country.cca2, country]));
const iso3ToIso2 = new Map(upstream.map((country) => [country.cca3, country.cca2]));
const supportedIso2 = new Set(baseCatalog.countries.map((country) => country.iso2));

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const missing = baseCatalog.countries
  .filter((country) => !upstreamByIso2.has(country.iso2))
  .map((country) => country.iso2);

if (missing.length > 0) {
  throw new Error(`Faltan países del catálogo base en la fuente: ${missing.join(', ')}`);
}

const countries = baseCatalog.countries.map((base) => {
  const source = upstreamByIso2.get(base.iso2);
  const capitalLatLng = source.capitalInfo?.latlng;
  if (!Array.isArray(capitalLatLng) || capitalLatLng.length !== 2) {
    throw new Error(`Faltan coordenadas de capital para ${base.iso2} (${base.name})`);
  }

  return {
    iso2: base.iso2,
    iso3: source.cca3,
    nameEn: base.name,
    nameEs: source.translations?.spa?.common || base.name,
    capital: base.capital,
    capitalLat: capitalLatLng[0],
    capitalLng: capitalLatLng[1],
    continent: base.continent,
    subregion: base.subregion || source.subregion || '',
    isLandlocked: base.isLandlocked ?? source.landlocked ?? false,
    population: source.population,
    areaKm2: source.area,
    languages: Object.entries(source.languages || {}).map(([code, name]) => ({ code, name })),
    neighbors: (source.borders || [])
      .map((iso3) => iso3ToIso2.get(iso3))
      .filter((iso2) => iso2 && supportedIso2.has(iso2))
      .sort(),
  };
});

for (const country of countries) {
  if (!Number.isFinite(country.population) || country.population <= 0) {
    throw new Error(`Población inválida para ${country.iso2}`);
  }
  if (!Number.isFinite(country.areaKm2) || country.areaKm2 <= 0) {
    throw new Error(`Área inválida para ${country.iso2}`);
  }
}

const result = {
  version: 'v1',
  generatedAt: getLocalDateString(),
  source: {
    name: 'REST Countries v3.1 dataset',
    repository: 'https://gitlab.com/restcountries/restcountries',
    license: 'MPL-2.0',
    note: 'Nombres canónicos, estado y flags se conservan desde country-catalog.v1.json.',
  },
  countries,
};

writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(`✓ Catálogo GeoRetos: ${countries.length} países → ${outputPath}`);
