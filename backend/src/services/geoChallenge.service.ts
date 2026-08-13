import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { haversineDistance } from '../utils/haversine.js';

export type GeoChallengeEngineVersion = 'v2';

export type GeoChallengeKind =
  | 'EXTREME'
  | 'HIGHER_LOWER'
  | 'COMMON_NEIGHBOR'
  | 'ODD_ONE_OUT'
  | 'NORTH_TO_SOUTH'
  | 'CAPITAL_PROXIMITY'
  | 'ORDER_BY_METRIC'
  | 'NEIGHBOR_COUNT'
  | 'BORDER_CHAIN';

export const ALL_9_KINDS: GeoChallengeKind[] = [
  'EXTREME',
  'HIGHER_LOWER',
  'COMMON_NEIGHBOR',
  'ODD_ONE_OUT',
  'NORTH_TO_SOUTH',
  'CAPITAL_PROXIMITY',
  'ORDER_BY_METRIC',
  'NEIGHBOR_COUNT',
  'BORDER_CHAIN',
];

export type GeoChallengeSelectionMode = 'single' | 'ordered';

export type GeoChallengeRegion = 'AFRICA' | 'AMERICAS' | 'ASIA' | 'EUROPE' | 'OCEANIA';

export type GeoChallengeDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface LocalizedText {
  es: string;
  en: string;
}

export interface GeoChallengeOption {
  id: string;
  label: LocalizedText;
}

export interface GeoChallengeRound {
  id: string;
  kind: GeoChallengeKind;
  region: GeoChallengeRegion;
  difficulty: GeoChallengeDifficulty;
  prompt: LocalizedText;
  instruction: LocalizedText;
  selectionMode: GeoChallengeSelectionMode;
  options: GeoChallengeOption[];
}

export interface GeoChallengeRoundWithAnswer extends GeoChallengeRound {
  correctOptionIds: string[];
  explanation: LocalizedText;
  involvedCountryIds: string[];
}

interface CatalogLanguage {
  code: string;
  name: string;
}

interface GeoChallengeCountry {
  iso2: string;
  iso3: string;
  nameEn: string;
  nameEs: string;
  capital: string;
  capitalLat: number;
  capitalLng: number;
  continent: string;
  subregion: string;
  isLandlocked: boolean;
  population: number;
  areaKm2: number;
  languages: CatalogLanguage[];
  neighbors: string[];
}

interface GeoChallengeCatalog {
  version: 'v1';
  generatedAt: string;
  countries: GeoChallengeCountry[];
}

export interface GeoChallengeGame {
  gameId: string;
  engineVersion: GeoChallengeEngineVersion;
  timePerRound: number;
  dataVersion: string;
  dataUpdatedAt: string;
  rounds: GeoChallengeRoundWithAnswer[];
}

type RandomSource = () => number;

const CATALOG_PATH = join(__dirname, '../../../data/geo-challenge-catalog.v1.json');
const TIME_PER_ROUND = 25;
const GEO_CHALLENGE_REGIONS: GeoChallengeRegion[] = ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE', 'OCEANIA'];
const NON_OCEANIA_REGIONS: GeoChallengeRegion[] = ['AFRICA', 'AMERICAS', 'ASIA', 'EUROPE'];
const MAX_ROUTE_ATTEMPTS = 100;

export class GeoChallengeGenerationRetry extends Error {
  constructor(message = 'No hay candidatos válidos para generar GeoReto V2') {
    super(message);
    this.name = 'GeoChallengeGenerationRetry';
  }
}

const FEATURED_LANGUAGES: Record<string, LocalizedText> = {
  ara: { es: 'árabe', en: 'Arabic' },
  deu: { es: 'alemán', en: 'German' },
  eng: { es: 'inglés', en: 'English' },
  fra: { es: 'francés', en: 'French' },
  ita: { es: 'italiano', en: 'Italian' },
  nld: { es: 'neerlandés', en: 'Dutch' },
  por: { es: 'portugués', en: 'Portuguese' },
  rus: { es: 'ruso', en: 'Russian' },
  spa: { es: 'español', en: 'Spanish' },
  zho: { es: 'chino', en: 'Chinese' },
};

let cachedCatalog: GeoChallengeCatalog | null = null;

export function loadGeoChallengeCatalog(): GeoChallengeCatalog {
  if (!cachedCatalog) {
    cachedCatalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as GeoChallengeCatalog;
  }
  return cachedCatalog;
}

function sample<T>(items: T[], rng: RandomSource): T {
  if (items.length === 0) throw new GeoChallengeGenerationRetry();
  return items[Math.floor(rng() * items.length) % items.length];
}

function shuffle<T>(items: T[], rng: RandomSource): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function takeRandom<T>(items: T[], count: number, rng: RandomSource): T[] {
  return shuffle(items, rng).slice(0, count);
}

function option(country: GeoChallengeOption | GeoChallengeCountry): GeoChallengeOption {
  if ('label' in country) return country as GeoChallengeOption;
  return {
    id: (country as GeoChallengeCountry).iso2,
    label: { es: (country as GeoChallengeCountry).nameEs, en: (country as GeoChallengeCountry).nameEn },
  };
}

function hasLanguage(country: GeoChallengeCountry, code: string): boolean {
  return country.languages.some((language) => language.code === code);
}

function regionOf(country: GeoChallengeCountry): GeoChallengeRegion {
  if (country.continent === 'North America' || country.continent === 'South America') return 'AMERICAS';
  return country.continent.toUpperCase() as GeoChallengeRegion;
}

function inRegion(countries: GeoChallengeCountry[], region: GeoChallengeRegion): GeoChallengeCountry[] {
  return countries.filter((country) => regionOf(country) === region);
}

function difficultyForGap(gap: number, mediumAt: number, easyAt: number): GeoChallengeDifficulty {
  if (gap >= easyAt) return 'EASY';
  if (gap >= mediumAt) return 'MEDIUM';
  return 'HARD';
}

function formatLatitude(latitude: number, locale: 'es' | 'en'): string {
  const degrees = Math.abs(latitude).toLocaleString(locale === 'es' ? 'es-CL' : 'en-US', {
    maximumFractionDigits: 1,
  });
  const hemisphere = latitude < 0 ? 'S' : 'N';
  return `${degrees}° ${hemisphere}`;
}

function formatMetric(value: number, metric: 'population' | 'area', locale: 'es' | 'en'): string {
  const formatted = new Intl.NumberFormat(locale === 'es' ? 'es-CL' : 'en-US', {
    notation: value >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
  if (metric === 'area') return `${formatted} km²`;
  return locale === 'es' ? `${formatted} habitantes` : `${formatted} people`;
}

export function getGeoChallengeBasePoints(difficulty?: GeoChallengeDifficulty): number {
  if (!difficulty) return 100;
  switch (difficulty) {
    case 'EASY': return 100;
    case 'MEDIUM': return 125;
    case 'HARD': return 150;
  }
}

function supportsRegion(kind: GeoChallengeKind, region: GeoChallengeRegion): boolean {
  if (region === 'OCEANIA') {
    if (kind === 'COMMON_NEIGHBOR' || kind === 'ODD_ONE_OUT' ||
        kind === 'NEIGHBOR_COUNT' || kind === 'BORDER_CHAIN') {
      return false;
    }
  }
  return true;
}

// ─── FACTORY: EXTREME (improved) ────────────────────────────────────────────

function makeExtremeRound(
  countries: GeoChallengeCountry[],
  region: GeoChallengeRegion,
  rng: RandomSource,
): GeoChallengeRoundWithAnswer {
  const regionalCountries = inRegion(countries, region);
  const goNorth = rng() < 0.5;
  const candidates = Object.entries(FEATURED_LANGUAGES)
    .map(([code, label]) => ({
      code,
      label,
      countries: regionalCountries.filter((country) => hasLanguage(country, code)),
    }))
    .filter((entry) => entry.countries.length >= 4);
  const selected = sample(candidates, rng);
  const picked = takeRandom(selected.countries, 4, rng);
  const sorted = [...picked].sort((a, b) => a.capitalLat - b.capitalLat);
  const correct = goNorth ? sorted[3] : sorted[0];
  const second = goNorth ? sorted[2] : sorted[1];
  const gap = Math.abs(correct.capitalLat - second.capitalLat);

  const promptEs = goNorth
    ? `¿Cuál tiene la capital más al norte entre estos países que usan ${selected.label.es}?`
    : `¿Cuál tiene la capital más al sur entre estos países que usan ${selected.label.es}?`;
  const promptEn = goNorth
    ? `Which has the northernmost capital among these countries that use ${selected.label.en}?`
    : `Which has the southernmost capital among these countries that use ${selected.label.en}?`;

  return {
    id: `extreme-${randomUUID()}`,
    kind: 'EXTREME',
    region,
    difficulty: difficultyForGap(gap, 5, 12),
    prompt: { es: promptEs, en: promptEn },
    instruction: {
      es: 'Elige un país. Se compara la latitud de su capital.',
      en: 'Choose one country. Capital latitude is compared.',
    },
    selectionMode: 'single',
    options: shuffle(picked, rng).map(option),
    correctOptionIds: [correct.iso2],
    involvedCountryIds: picked.map((country) => country.iso2),
    explanation: {
      es: `${correct.capital}, capital de ${correct.nameEs}, está a ${formatLatitude(correct.capitalLat, 'es')}.`,
      en: `${correct.capital}, the capital of ${correct.nameEn}, is at ${formatLatitude(correct.capitalLat, 'en')}.`,
    },
  };
}

// ─── FACTORY: HIGHER_LOWER ──────────────────────────────────────────────────

function makeHigherLowerRound(
  countries: GeoChallengeCountry[],
  region: GeoChallengeRegion,
  rng: RandomSource,
): GeoChallengeRoundWithAnswer {
  const regionalCountries = inRegion(countries, region);
  const metric = rng() < 0.5 ? 'population' : 'area';
  const valueOf = (country: GeoChallengeCountry) => metric === 'population' ? country.population : country.areaKm2;
  let pair: [GeoChallengeCountry, GeoChallengeCountry] | null = null;

  for (let attempt = 0; attempt < 200 && !pair; attempt += 1) {
    const first = sample(regionalCountries, rng);
    const peers = regionalCountries.filter((country) => country.iso2 !== first.iso2);
    const second = sample(peers, rng);
    const ratio = Math.max(valueOf(first), valueOf(second)) / Math.min(valueOf(first), valueOf(second));
    if (ratio >= 1.35 && ratio <= 12) pair = [first, second];
  }

  if (!pair) throw new GeoChallengeGenerationRetry();
  const [first, second] = pair;
  const ratio = Math.max(valueOf(first), valueOf(second)) / Math.min(valueOf(first), valueOf(second));
  const correct = valueOf(first) > valueOf(second) ? first : second;
  const metricEs = metric === 'population' ? 'mayor población' : 'mayor superficie';
  const metricEn = metric === 'population' ? 'larger population' : 'larger area';

  return {
    id: `higher-lower-${randomUUID()}`,
    kind: 'HIGHER_LOWER',
    region,
    difficulty: ratio >= 4 ? 'EASY' : ratio >= 2 ? 'MEDIUM' : 'HARD',
    prompt: { es: `¿Cuál tiene ${metricEs}?`, en: `Which has the ${metricEn}?` },
    instruction: { es: 'Compara los dos países.', en: 'Compare the two countries.' },
    selectionMode: 'single',
    options: shuffle(pair, rng).map(option),
    correctOptionIds: [correct.iso2],
    involvedCountryIds: pair.map((country) => country.iso2),
    explanation: {
      es: `${first.nameEs}: ${formatMetric(valueOf(first), metric, 'es')} · ${second.nameEs}: ${formatMetric(valueOf(second), metric, 'es')}.`,
      en: `${first.nameEn}: ${formatMetric(valueOf(first), metric, 'en')} · ${second.nameEn}: ${formatMetric(valueOf(second), metric, 'en')}.`,
    },
  };
}

// ─── FACTORY: COMMON_NEIGHBOR (improved distractors) ────────────────────────

function makeCommonNeighborRound(
  countries: GeoChallengeCountry[],
  region: GeoChallengeRegion,
  rng: RandomSource,
): GeoChallengeRoundWithAnswer {
  const regionalCountries = inRegion(countries, region);
  const byIso2 = new Map(countries.map((country) => [country.iso2, country]));

  for (let attempt = 0; attempt < 300; attempt += 1) {
    const first = sample(regionalCountries, rng);
    if (first.neighbors.length < 2) continue;
    const second = sample(regionalCountries.filter((c) => c.iso2 !== first.iso2 && c.neighbors.length >= 2), rng);
    const shared = first.neighbors.filter((iso2) => second.neighbors.includes(iso2));
    if (shared.length !== 1) continue;
    const common = byIso2.get(shared[0]);
    if (!common || regionOf(common) !== region) continue;

    const plausibleDistractors = regionalCountries.filter((country) =>
      country.iso2 !== common.iso2 &&
      country.iso2 !== first.iso2 &&
      country.iso2 !== second.iso2 &&
      ((first.neighbors.includes(country.iso2) && !second.neighbors.includes(country.iso2)) ||
       (!first.neighbors.includes(country.iso2) && second.neighbors.includes(country.iso2)))
    );

    const fallbackDistractors = regionalCountries.filter((country) =>
      country.iso2 !== common.iso2 &&
      country.iso2 !== first.iso2 &&
      country.iso2 !== second.iso2 &&
      !first.neighbors.includes(country.iso2) &&
      !second.neighbors.includes(country.iso2)
    );

    let distractors: GeoChallengeCountry[];
    if (plausibleDistractors.length >= 3) {
      distractors = takeRandom(plausibleDistractors, 3, rng);
    } else {
      distractors = [...takeRandom(plausibleDistractors, plausibleDistractors.length, rng)];
      const needed = 3 - distractors.length;
      distractors.push(...takeRandom(fallbackDistractors.filter((c) => !distractors.find((d) => d.iso2 === c.iso2)), needed, rng));
    }

    if (distractors.length < 3) continue;

    const plausibleCount = Math.min(plausibleDistractors.length, 3);
    let difficulty: GeoChallengeDifficulty;
    if (plausibleCount === 0) difficulty = 'EASY';
    else if (plausibleCount <= 2) difficulty = 'MEDIUM';
    else difficulty = 'HARD';

    return {
      id: `common-neighbor-${randomUUID()}`,
      kind: 'COMMON_NEIGHBOR',
      region,
      difficulty,
      prompt: {
        es: `¿Qué país limita por tierra tanto con ${first.nameEs} como con ${second.nameEs}?`,
        en: `Which country shares a land border with both ${first.nameEn} and ${second.nameEn}?`,
      },
      instruction: { es: 'Elige el único vecino común.', en: 'Choose the only common neighbor.' },
      selectionMode: 'single',
      options: shuffle([common, ...distractors], rng).map(option),
      correctOptionIds: [common.iso2],
      involvedCountryIds: [first.iso2, second.iso2, common.iso2, ...distractors.map((c) => c.iso2)],
      explanation: {
        es: `${common.nameEs} comparte frontera terrestre con ambos países.`,
        en: `${common.nameEn} shares a land border with both countries.`,
      },
    };
  }

  throw new GeoChallengeGenerationRetry();
}

// ─── FACTORY: ODD_ONE_OUT (difficulty by language rarity) ───────────────────

function makeOddOneOutRound(
  countries: GeoChallengeCountry[],
  region: GeoChallengeRegion,
  rng: RandomSource,
): GeoChallengeRoundWithAnswer {
  const regionalCountries = inRegion(countries, region);
  const candidates: Array<{
    code: string;
    label: LocalizedText;
    members: GeoChallengeCountry[];
    outsiders: GeoChallengeCountry[];
  }> = [];

  for (const [code, label] of Object.entries(FEATURED_LANGUAGES)) {
    const members = regionalCountries.filter((country) => hasLanguage(country, code));
    const outsiders = regionalCountries.filter((country) => !hasLanguage(country, code));
    if (members.length >= 3 && outsiders.length >= 1) candidates.push({ code, label, members, outsiders });
  }

  const selected = sample(candidates, rng);
  const members = takeRandom(selected.members, 3, rng);
  const outsider = sample(selected.outsiders, rng);

  const speakerCount = selected.members.length;
  let difficulty: GeoChallengeDifficulty;
  if (speakerCount >= 9) difficulty = 'EASY';
  else if (speakerCount >= 5) difficulty = 'MEDIUM';
  else difficulty = 'HARD';

  return {
    id: `odd-one-out-${randomUUID()}`,
    kind: 'ODD_ONE_OUT',
    region,
    difficulty,
    prompt: {
      es: `¿Cuál es el intruso? Tres usan ${selected.label.es}; uno no.`,
      en: `Which is the odd one out? Three use ${selected.label.en}; one does not.`,
    },
    instruction: { es: 'Elige el país diferente.', en: 'Choose the different country.' },
    selectionMode: 'single',
    options: shuffle([...members, outsider], rng).map(option),
    correctOptionIds: [outsider.iso2],
    involvedCountryIds: [...members.map((country) => country.iso2), outsider.iso2],
    explanation: {
      es: `${outsider.nameEs} es el único de los cuatro que no usa ${selected.label.es}.`,
      en: `${outsider.nameEn} is the only one of the four that does not use ${selected.label.en}.`,
    },
  };
}

// ─── FACTORY: NORTH_TO_SOUTH ────────────────────────────────────────────────

function makeNorthToSouthRound(
  countries: GeoChallengeCountry[],
  region: GeoChallengeRegion,
  rng: RandomSource,
): GeoChallengeRoundWithAnswer {
  const regionalCountries = inRegion(countries, region);
  let selected: GeoChallengeCountry[] | null = null;

  for (let attempt = 0; attempt < 300 && !selected; attempt += 1) {
    const picked = takeRandom(regionalCountries, 4, rng);
    const sorted = [...picked].sort((a, b) => b.capitalLat - a.capitalLat);
    const hasClearGaps = sorted.every((country, index) =>
      index === sorted.length - 1 || country.capitalLat - sorted[index + 1].capitalLat >= 2.5
    );
    if (picked.length === 4 && hasClearGaps) selected = sorted;
  }

  if (!selected) throw new GeoChallengeGenerationRetry();
  const minimumGap = Math.min(...selected.slice(0, -1).map((country, index) =>
    country.capitalLat - selected![index + 1].capitalLat
  ));
  const explanationEs = selected.map((country) => `${country.nameEs} (${formatLatitude(country.capitalLat, 'es')})`).join(' → ');
  const explanationEn = selected.map((country) => `${country.nameEn} (${formatLatitude(country.capitalLat, 'en')})`).join(' → ');

  return {
    id: `north-south-${randomUUID()}`,
    kind: 'NORTH_TO_SOUTH',
    region,
    difficulty: difficultyForGap(minimumGap, 5, 10),
    prompt: {
      es: 'Ordena estos países según la ubicación de su capital, de norte a sur.',
      en: 'Order these countries by capital location, from north to south.',
    },
    instruction: {
      es: 'Tócalos en orden. Puedes deshacer antes de confirmar.',
      en: 'Tap them in order. You can undo before confirming.',
    },
    selectionMode: 'ordered',
    options: shuffle(selected, rng).map(option),
    correctOptionIds: selected.map((country) => country.iso2),
    involvedCountryIds: selected.map((country) => country.iso2),
    explanation: { es: explanationEs, en: explanationEn },
  };
}

// ─── FACTORY: CAPITAL_PROXIMITY ─────────────────────────────────────────────

function makeCapitalProximityRound(
  countries: GeoChallengeCountry[],
  region: GeoChallengeRegion,
  rng: RandomSource,
): GeoChallengeRoundWithAnswer {
  const regionalCountries = inRegion(countries, region);

  for (let attempt = 0; attempt < 300; attempt += 1) {
    const anchor = sample(regionalCountries, rng);
    const others = regionalCountries.filter((c) => c.iso2 !== anchor.iso2);
    const candidates = takeRandom(others, 4, rng);
    if (candidates.length < 4) continue;

    const distances = candidates.map((c) => ({
      country: c,
      dist: haversineDistance(anchor.capitalLat, anchor.capitalLng, c.capitalLat, c.capitalLng),
    }));
    distances.sort((a, b) => a.dist - b.dist);

    const gap = distances[1].dist - distances[0].dist;
    if (gap < 75) continue;

    const ratio = distances[1].dist / distances[0].dist;
    let difficulty: GeoChallengeDifficulty;
    if (ratio >= 2.0) difficulty = 'EASY';
    else if (ratio >= 1.35) difficulty = 'MEDIUM';
    else difficulty = 'HARD';

    const correct = distances[0].country;
    const firstDist = Math.round(distances[0].dist);

    return {
      id: `capital-proximity-${randomUUID()}`,
      kind: 'CAPITAL_PROXIMITY',
      region,
      difficulty,
      prompt: {
        es: `¿Qué capital está más cerca de ${anchor.capital}?`,
        en: `Which capital is closest to ${anchor.capital}?`,
      },
      instruction: {
        es: 'Elige el país cuya capital está más cerca de la ciudad mencionada.',
        en: 'Choose the country whose capital is closest to the mentioned city.',
      },
      selectionMode: 'single',
      options: shuffle(candidates, rng).map(option),
      correctOptionIds: [correct.iso2],
      involvedCountryIds: [anchor.iso2, ...candidates.map((c) => c.iso2)],
      explanation: {
        es: `${anchor.capital} ↔ ${correct.capital}: ~${firstDist.toLocaleString('es-CL')} km.`,
        en: `${anchor.capital} ↔ ${correct.capital}: ~${firstDist.toLocaleString('en-US')} km.`,
      },
    };
  }

  throw new GeoChallengeGenerationRetry();
}

// ─── FACTORY: ORDER_BY_METRIC ───────────────────────────────────────────────

function makeOrderByMetricRound(
  countries: GeoChallengeCountry[],
  region: GeoChallengeRegion,
  rng: RandomSource,
): GeoChallengeRoundWithAnswer {
  const regionalCountries = inRegion(countries, region);
  const metric = rng() < 0.5 ? 'population' : 'area';
  const valueOf = (c: GeoChallengeCountry) => metric === 'population' ? c.population : c.areaKm2;

  for (let attempt = 0; attempt < 300; attempt += 1) {
    const picked = takeRandom(regionalCountries, 4, rng);
    const sorted = [...picked].sort((a, b) => valueOf(b) - valueOf(a));

    let hasCloseValues = false;
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const ratio = valueOf(sorted[i]) / valueOf(sorted[i + 1]);
      if (ratio < 1.08) { hasCloseValues = true; break; }
    }
    if (hasCloseValues) continue;

    const minRatio = Math.min(...sorted.slice(0, -1).map((c, i) => valueOf(c) / valueOf(sorted[i + 1])));
    let difficulty: GeoChallengeDifficulty;
    if (minRatio >= 2.0) difficulty = 'EASY';
    else if (minRatio >= 1.35) difficulty = 'MEDIUM';
    else difficulty = 'HARD';

    const metricEs = metric === 'population' ? 'población' : 'superficie';
    const metricEn = metric === 'population' ? 'population' : 'area';
    const explanationEs = sorted.map((c) => `${c.nameEs}: ${formatMetric(valueOf(c), metric, 'es')}`).join(' · ');
    const explanationEn = sorted.map((c) => `${c.nameEn}: ${formatMetric(valueOf(c), metric, 'en')}`).join(' · ');

    return {
      id: `order-by-metric-${randomUUID()}`,
      kind: 'ORDER_BY_METRIC',
      region,
      difficulty,
      prompt: {
        es: `Ordena de mayor a menor ${metricEs}`,
        en: `Order from largest to smallest ${metricEn}`,
      },
      instruction: {
        es: 'Tócalos en orden. Puedes deshacer antes de confirmar.',
        en: 'Tap them in order. You can undo before confirming.',
      },
      selectionMode: 'ordered',
      options: shuffle(sorted, rng).map(option),
      correctOptionIds: sorted.map((c) => c.iso2),
      involvedCountryIds: sorted.map((c) => c.iso2),
      explanation: { es: explanationEs, en: explanationEn },
    };
  }

  throw new GeoChallengeGenerationRetry();
}

// ─── FACTORY: NEIGHBOR_COUNT ────────────────────────────────────────────────

function makeNeighborCountRound(
  countries: GeoChallengeCountry[],
  region: GeoChallengeRegion,
  rng: RandomSource,
): GeoChallengeRoundWithAnswer {
  const regionalCountries = inRegion(countries, region);

  for (let attempt = 0; attempt < 300; attempt += 1) {
    const picked = takeRandom(regionalCountries, 4, rng);
    const withCounts = picked.map((c) => ({ country: c, count: c.neighbors.length }));
    const goMost = rng() < 0.5;

    if (goMost) {
      withCounts.sort((a, b) => b.count - a.count);
      if (withCounts[0].count === withCounts[1].count) continue;
      const gap = withCounts[0].count - withCounts[1].count;
      let difficulty: GeoChallengeDifficulty;
      if (gap >= 4) difficulty = 'EASY';
      else if (gap >= 2) difficulty = 'MEDIUM';
      else difficulty = 'HARD';

      const correct = withCounts[0].country;
      const explanationEs = withCounts.map(({ country, count }) => `${country.nameEs}: ${count}`).join(' · ');
      const explanationEn = withCounts.map(({ country, count }) => `${country.nameEn}: ${count}`).join(' · ');

      return {
        id: `neighbor-count-${randomUUID()}`,
        kind: 'NEIGHBOR_COUNT',
        region,
        difficulty,
        prompt: {
          es: '¿Cuál de estos países tiene más fronteras terrestres?',
          en: 'Which of these countries has the most land borders?',
        },
        instruction: { es: 'Elige el país con más vecinos.', en: 'Choose the country with the most neighbors.' },
        selectionMode: 'single',
        options: shuffle(picked, rng).map(option),
        correctOptionIds: [correct.iso2],
        involvedCountryIds: picked.map((c) => c.iso2),
        explanation: { es: explanationEs, en: explanationEn },
      };
    } else {
      withCounts.sort((a, b) => a.count - b.count);
      if (withCounts[0].count === withCounts[1].count) continue;
      const gap = withCounts[1].count - withCounts[0].count;
      let difficulty: GeoChallengeDifficulty;
      if (gap >= 4) difficulty = 'EASY';
      else if (gap >= 2) difficulty = 'MEDIUM';
      else difficulty = 'HARD';

      const correct = withCounts[0].country;
      const explanationEs = withCounts.map(({ country, count }) => `${country.nameEs}: ${count}`).join(' · ');
      const explanationEn = withCounts.map(({ country, count }) => `${country.nameEn}: ${count}`).join(' · ');

      return {
        id: `neighbor-count-${randomUUID()}`,
        kind: 'NEIGHBOR_COUNT',
        region,
        difficulty,
        prompt: {
          es: '¿Cuál de estos países tiene menos fronteras terrestres?',
          en: 'Which of these countries has the fewest land borders?',
        },
        instruction: { es: 'Elige el país con menos vecinos.', en: 'Choose the country with the fewest neighbors.' },
        selectionMode: 'single',
        options: shuffle(picked, rng).map(option),
        correctOptionIds: [correct.iso2],
        involvedCountryIds: picked.map((c) => c.iso2),
        explanation: { es: explanationEs, en: explanationEn },
      };
    }
  }

  throw new GeoChallengeGenerationRetry();
}

// ─── FACTORY: BORDER_CHAIN ──────────────────────────────────────────────────

function makeBorderChainRound(
  countries: GeoChallengeCountry[],
  region: GeoChallengeRegion,
  rng: RandomSource,
): GeoChallengeRoundWithAnswer {
  const regionalCountries = inRegion(countries, region);
  const byIso2 = new Map(countries.map((c) => [c.iso2, c]));

  for (let attempt = 0; attempt < 300; attempt += 1) {
    const start = sample(regionalCountries.filter((c) => c.neighbors.length >= 1), rng);
    const neighborsOfStart = start.neighbors
      .map((id) => byIso2.get(id))
      .filter((c): c is GeoChallengeCountry => !!c && regionOf(c) === region && c.iso2 !== start.iso2);
    if (neighborsOfStart.length === 0) continue;
    const b = sample(neighborsOfStart, rng);

    const neighborsOfB = b.neighbors
      .map((id) => byIso2.get(id))
      .filter((c): c is GeoChallengeCountry => !!c && regionOf(c) === region && c.iso2 !== start.iso2 && c.iso2 !== b.iso2);
    if (neighborsOfB.length === 0) continue;
    const c = sample(neighborsOfB, rng);

    const neighborsOfC = c.neighbors
      .map((id) => byIso2.get(id))
      .filter((candidate): candidate is GeoChallengeCountry => !!candidate && regionOf(candidate) === region && candidate.iso2 !== start.iso2 && candidate.iso2 !== b.iso2 && candidate.iso2 !== c.iso2);
    if (neighborsOfC.length === 0) continue;
    const d = sample(neighborsOfC, rng);

    if (start.neighbors.includes(c.iso2)) continue;
    if (start.neighbors.includes(d.iso2)) continue;
    if (b.neighbors.includes(d.iso2)) continue;

    const chain = [start, b, c, d];
    const explanationEs = chain.map((country) => country.nameEs).join(' → ');
    const explanationEn = chain.map((country) => country.nameEn).join(' → ');

    return {
      id: `border-chain-${randomUUID()}`,
      kind: 'BORDER_CHAIN',
      region,
      difficulty: 'HARD',
      prompt: {
        es: `Construye una ruta terrestre empezando en ${start.nameEs}.`,
        en: `Build a land route starting from ${start.nameEn}.`,
      },
      instruction: {
        es: 'Tócalos en orden. Cada país debe limitar con el siguiente.',
        en: 'Tap them in order. Each country must border the next.',
      },
      selectionMode: 'ordered',
      options: shuffle(chain, rng).map(option),
      correctOptionIds: chain.map((country) => country.iso2),
      involvedCountryIds: chain.map((country) => country.iso2),
      explanation: { es: explanationEs, en: explanationEn },
    };
  }

  throw new GeoChallengeGenerationRetry();
}

// ─── ROUND FACTORY MAP ──────────────────────────────────────────────────────

type RoundFactory = (
  countries: GeoChallengeCountry[],
  region: GeoChallengeRegion,
  rng: RandomSource,
) => GeoChallengeRoundWithAnswer;

const ROUND_FACTORIES: Record<GeoChallengeKind, RoundFactory> = {
  EXTREME: makeExtremeRound,
  HIGHER_LOWER: makeHigherLowerRound,
  COMMON_NEIGHBOR: makeCommonNeighborRound,
  ODD_ONE_OUT: makeOddOneOutRound,
  NORTH_TO_SOUTH: makeNorthToSouthRound,
  CAPITAL_PROXIMITY: makeCapitalProximityRound,
  ORDER_BY_METRIC: makeOrderByMetricRound,
  NEIGHBOR_COUNT: makeNeighborCountRound,
  BORDER_CHAIN: makeBorderChainRound,
};

// ─── V2 COMPOSERS ───────────────────────────────────────────────────────────

function buildGeoChallengeGameV2(rng: RandomSource = Math.random): GeoChallengeGame {
  const catalog = loadGeoChallengeCatalog();

  for (let attempt = 0; attempt < MAX_ROUTE_ATTEMPTS; attempt += 1) {
    try {
      const kinds = shuffle([...ALL_9_KINDS], rng).slice(0, 7);
      const regions = [
        ...shuffle([...GEO_CHALLENGE_REGIONS], rng),
        ...takeRandom(NON_OCEANIA_REGIONS, 2, rng),
      ];

      const restrictedKinds = kinds.filter((k) => !supportsRegion(k, 'OCEANIA'));
      const flexibleKinds = kinds.filter((k) => supportsRegion(k, 'OCEANIA'));

      const nonOceaniaSlots = regions.filter((r) => r !== 'OCEANIA');
      const shuffledNonOceania = shuffle(nonOceaniaSlots, rng);

      const kindRegionPairs: Array<{ kind: GeoChallengeKind; region: GeoChallengeRegion }> = [];

      for (let i = 0; i < restrictedKinds.length; i += 1) {
        kindRegionPairs.push({ kind: restrictedKinds[i], region: shuffledNonOceania[i] });
      }

      const usedNonOceania = new Set(shuffledNonOceania.slice(0, restrictedKinds.length));
      const remainingNonOceania = shuffledNonOceania.slice(restrictedKinds.length);
      const oceaniaSlots = regions.filter((r) => r === 'OCEANIA');
      const allRemaining = shuffle([...remainingNonOceania, ...oceaniaSlots], rng);

      for (let i = 0; i < flexibleKinds.length; i += 1) {
        kindRegionPairs.push({ kind: flexibleKinds[i], region: allRemaining[i] });
      }

      const HARD_KINDS = new Set<GeoChallengeKind>(['BORDER_CHAIN', 'NEIGHBOR_COUNT', 'COMMON_NEIGHBOR']);
      const generationOrder = [...kindRegionPairs].sort((a, b) => {
        const aHard = HARD_KINDS.has(a.kind) ? 0 : 1;
        const bHard = HARD_KINDS.has(b.kind) ? 0 : 1;
        return aHard - bHard;
      });

      const usedCountryIds = new Set<string>();
      const roundMap = new Map<string, GeoChallengeRoundWithAnswer>();

      for (const { kind, region } of generationOrder) {
        const key = `${kind}::${region}`;
        const availableCountries = catalog.countries.filter((c) => !usedCountryIds.has(c.iso2));
        const round = ROUND_FACTORIES[kind](availableCountries, region, rng);
        for (const id of round.involvedCountryIds) {
          if (usedCountryIds.has(id)) throw new GeoChallengeGenerationRetry();
          usedCountryIds.add(id);
        }
        roundMap.set(key, round);
      }

      const rounds = kindRegionPairs.map(({ kind, region }) => {
        const key = `${kind}::${region}`;
        return roundMap.get(key)!;
      });

      const easy = rounds.filter((r) => r.difficulty === 'EASY');
      const medium = rounds.filter((r) => r.difficulty === 'MEDIUM');
      const hard = rounds.filter((r) => r.difficulty === 'HARD');
      const ordered = [...shuffle(easy, rng), ...shuffle(medium, rng), ...shuffle(hard, rng)];

      return {
        gameId: randomUUID(),
        engineVersion: 'v2',
        timePerRound: TIME_PER_ROUND,
        dataVersion: catalog.version,
        dataUpdatedAt: catalog.generatedAt,
        rounds: ordered,
      };
    } catch (e) {
      if (e instanceof GeoChallengeGenerationRetry) continue;
      throw e;
    }
  }

  throw new Error('GEO_CHALLENGE_GENERATION_FAILED: no se pudo generar partida V2 tras 100 intentos');
}

function buildGeoChallengeDuelGameV2(rng: RandomSource = Math.random): GeoChallengeGame {
  const catalog = loadGeoChallengeCatalog();
  let lastFail = '';

  for (let attempt = 0; attempt < MAX_ROUTE_ATTEMPTS; attempt += 1) {
    try {
      const duplicateKind = sample([...ALL_9_KINDS], rng);
      const kinds = [...ALL_9_KINDS, duplicateKind];

      const restrictedKinds = kinds.filter((k) => !supportsRegion(k, 'OCEANIA'));
      const flexibleKinds = kinds.filter((k) => supportsRegion(k, 'OCEANIA'));

      const nonOceaniaRegions: GeoChallengeRegion[] = ['AFRICA', 'AFRICA', 'AMERICAS', 'AMERICAS', 'ASIA', 'ASIA', 'EUROPE', 'EUROPE'];
      const oceaniaRegions: GeoChallengeRegion[] = ['OCEANIA', 'OCEANIA'];

      const shuffledNonOceania = shuffle(nonOceaniaRegions, rng);
      const shuffledOceania = shuffle(oceaniaRegions, rng);

      let kindRegionPairs: Array<{ kind: GeoChallengeKind; region: GeoChallengeRegion }> = [];

      for (let i = 0; i < restrictedKinds.length; i += 1) {
        kindRegionPairs.push({ kind: restrictedKinds[i], region: shuffledNonOceania[i] });
      }
      const remainingNonOceania = shuffledNonOceania.slice(restrictedKinds.length);
      const allRemaining = [...remainingNonOceania, ...shuffledOceania];
      const shuffledRemaining = shuffle(allRemaining, rng);

      for (let i = 0; i < flexibleKinds.length; i += 1) {
        kindRegionPairs.push({ kind: flexibleKinds[i], region: shuffledRemaining[i] });
      }

      kindRegionPairs = shuffle(kindRegionPairs, rng);

      let hasConsecutive = true;
      let swapAttempts = 0;
      while (hasConsecutive && swapAttempts < 50) {
        hasConsecutive = false;
        swapAttempts += 1;
        for (let i = 1; i < kindRegionPairs.length; i += 1) {
          if (kindRegionPairs[i].kind === kindRegionPairs[i - 1].kind) {
            const targetKind = kindRegionPairs[i].kind;
            let swapped = false;
            for (let j = i + 2; j < kindRegionPairs.length; j += 1) {
              if (kindRegionPairs[j].kind !== targetKind) {
                [kindRegionPairs[i], kindRegionPairs[j]] = [kindRegionPairs[j], kindRegionPairs[i]];
                swapped = true;
                break;
              }
            }
            if (!swapped) {
              for (let j = 0; j < i - 1; j += 1) {
                if (kindRegionPairs[j].kind !== targetKind) {
                  [kindRegionPairs[i], kindRegionPairs[j]] = [kindRegionPairs[j], kindRegionPairs[i]];
                  swapped = true;
                  break;
                }
              }
            }
            if (swapped) {
              hasConsecutive = true;
              break;
            }
          }
        }
      }

      const HARD_KINDS = new Set<GeoChallengeKind>(['BORDER_CHAIN', 'NEIGHBOR_COUNT', 'COMMON_NEIGHBOR']);
      const generationOrder = [...kindRegionPairs].sort((a, b) => {
        const aHard = HARD_KINDS.has(a.kind) ? 0 : 1;
        const bHard = HARD_KINDS.has(b.kind) ? 0 : 1;
        return aHard - bHard;
      });

      const usedCountryIds = new Set<string>();
      const rounds: GeoChallengeRoundWithAnswer[] = new Array(kindRegionPairs.length);
      const generated = new Set<number>();

      for (const pair of generationOrder) {
        const originalIdx = kindRegionPairs.findIndex((p, i) => p.kind === pair.kind && p.region === pair.region && !generated.has(i));
        const availableCountries = catalog.countries.filter((c) => !usedCountryIds.has(c.iso2));
        try {
          const round = ROUND_FACTORIES[pair.kind](availableCountries, pair.region, rng);
          for (const id of round.involvedCountryIds) {
            if (usedCountryIds.has(id)) throw new GeoChallengeGenerationRetry();
            usedCountryIds.add(id);
          }
          rounds[originalIdx] = round;
          generated.add(originalIdx);
        } catch (e) {
          if (e instanceof GeoChallengeGenerationRetry) {
            lastFail = `${pair.kind} in ${pair.region} (${availableCountries.length} available)`;
          }
          throw e;
        }
      }

      return {
        gameId: randomUUID(),
        engineVersion: 'v2',
        timePerRound: TIME_PER_ROUND,
        dataVersion: catalog.version,
        dataUpdatedAt: catalog.generatedAt,
        rounds,
      };
    } catch (e) {
      if (e instanceof GeoChallengeGenerationRetry) continue;
      throw e;
    }
  }

  throw new Error(`GEO_CHALLENGE_GENERATION_FAILED: no se pudo generar duelo V2 tras 100 intentos (last fail: ${lastFail || 'unknown'})`);
}

// ─── V1 COMPATIBILITY WRAPPERS ──────────────────────────────────────────────

export function buildGeoChallengeGame(rng: RandomSource = Math.random): GeoChallengeGame {
  return buildGeoChallengeGameV2(rng);
}

export function buildGeoChallengeDuelGame(rng: RandomSource = Math.random): GeoChallengeGame {
  return buildGeoChallengeDuelGameV2(rng);
}

// ─── UTILS ──────────────────────────────────────────────────────────────────

export function isGeoChallengeAnswerCorrect(correctOptionIds: string[], selectedOptionIds: string[]): boolean {
  return correctOptionIds.length === selectedOptionIds.length &&
    correctOptionIds.every((optionId, index) => optionId === selectedOptionIds[index]);
}

export function toPublicGeoChallengeRound(round: GeoChallengeRoundWithAnswer): GeoChallengeRound {
  const {
    correctOptionIds: _correctOptionIds,
    explanation: _explanation,
    involvedCountryIds: _involvedCountryIds,
    ...publicRound
  } = round;
  return publicRound;
}
