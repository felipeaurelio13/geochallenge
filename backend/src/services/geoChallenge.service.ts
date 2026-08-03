import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

export type GeoChallengeKind =
  | 'EXTREME'
  | 'HIGHER_LOWER'
  | 'COMMON_NEIGHBOR'
  | 'ODD_ONE_OUT'
  | 'NORTH_TO_SOUTH';

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
  if (items.length === 0) throw new Error('No hay candidatos para generar GeoReto');
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

function option(country: GeoChallengeCountry): GeoChallengeOption {
  return {
    id: country.iso2,
    label: { es: country.nameEs, en: country.nameEn },
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

function makeExtremeRound(
  countries: GeoChallengeCountry[],
  region: GeoChallengeRegion,
  rng: RandomSource,
): GeoChallengeRoundWithAnswer {
  const regionalCountries = inRegion(countries, region);
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
  const correct = sorted[0];
  const gap = sorted[1].capitalLat - correct.capitalLat;

  return {
    id: `extreme-${randomUUID()}`,
    kind: 'EXTREME',
    region,
    difficulty: difficultyForGap(gap, 5, 12),
    prompt: {
      es: `¿Cuál tiene la capital más al sur entre estos países que usan ${selected.label.es}?`,
      en: `Which has the southernmost capital among these countries that use ${selected.label.en}?`,
    },
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

  if (!pair) throw new Error('No se pudo generar comparación GeoReto');
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

function makeCommonNeighborRound(
  countries: GeoChallengeCountry[],
  region: GeoChallengeRegion,
  rng: RandomSource,
): GeoChallengeRoundWithAnswer {
  const regionalCountries = inRegion(countries, region);
  const byIso2 = new Map(countries.map((country) => [country.iso2, country]));
  const candidates: Array<{
    first: GeoChallengeCountry;
    second: GeoChallengeCountry;
    common: GeoChallengeCountry;
    distractors: GeoChallengeCountry[];
  }> = [];

  for (let firstIndex = 0; firstIndex < regionalCountries.length; firstIndex += 1) {
    const first = regionalCountries[firstIndex];
    if (first.neighbors.length < 2) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < regionalCountries.length; secondIndex += 1) {
      const second = regionalCountries[secondIndex];
      if (second.neighbors.length < 2) continue;
      const shared = first.neighbors.filter((iso2) => second.neighbors.includes(iso2));
      if (shared.length !== 1) continue;
      const common = byIso2.get(shared[0]);
      if (!common || regionOf(common) !== region) continue;
      const distractors = regionalCountries.filter((country) =>
        country.iso2 !== common.iso2 &&
        country.iso2 !== first.iso2 &&
        country.iso2 !== second.iso2 &&
        !first.neighbors.includes(country.iso2) &&
        !second.neighbors.includes(country.iso2)
      );
      if (distractors.length >= 3) candidates.push({ first, second, common, distractors });
    }
  }

  const candidatesByAnswer = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const answerCandidates = candidatesByAnswer.get(candidate.common.iso2) ?? [];
    answerCandidates.push(candidate);
    candidatesByAnswer.set(candidate.common.iso2, answerCandidates);
  }
  const selected = sample(sample([...candidatesByAnswer.values()], rng), rng);
  const distractors = takeRandom(selected.distractors, 3, rng);

  return {
    id: `common-neighbor-${randomUUID()}`,
    kind: 'COMMON_NEIGHBOR',
    region,
    difficulty: 'MEDIUM',
    prompt: {
      es: `¿Qué país limita por tierra tanto con ${selected.first.nameEs} como con ${selected.second.nameEs}?`,
      en: `Which country shares a land border with both ${selected.first.nameEn} and ${selected.second.nameEn}?`,
    },
    instruction: { es: 'Elige el único vecino común.', en: 'Choose the only common neighbor.' },
    selectionMode: 'single',
    options: shuffle([selected.common, ...distractors], rng).map(option),
    correctOptionIds: [selected.common.iso2],
    involvedCountryIds: [
      selected.first.iso2,
      selected.second.iso2,
      selected.common.iso2,
      ...distractors.map((country) => country.iso2),
    ],
    explanation: {
      es: `${selected.common.nameEs} comparte frontera terrestre con ambos países.`,
      en: `${selected.common.nameEn} shares a land border with both countries.`,
    },
  };
}

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

  return {
    id: `odd-one-out-${randomUUID()}`,
    kind: 'ODD_ONE_OUT',
    region,
    difficulty: 'MEDIUM',
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

  if (!selected) throw new Error('No se pudo generar orden norte-sur');
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

export function buildGeoChallengeGame(rng: RandomSource = Math.random): GeoChallengeGame {
  const catalog = loadGeoChallengeCatalog();
  return buildGeoChallengeGameFromCountries(catalog, catalog.countries, rng);
}

function buildGeoChallengeGameFromCountries(
  catalog: GeoChallengeCatalog,
  countries: GeoChallengeCountry[],
  rng: RandomSource,
): GeoChallengeGame {
  const [oddOneOutRegion, commonNeighborRegion] = takeRandom(NON_OCEANIA_REGIONS, 2, rng);
  const flexibleRegions = shuffle(
    GEO_CHALLENGE_REGIONS.filter((region) => region !== oddOneOutRegion && region !== commonNeighborRegion),
    rng,
  );
  return {
    gameId: randomUUID(),
    timePerRound: TIME_PER_ROUND,
    dataVersion: catalog.version,
    dataUpdatedAt: catalog.generatedAt,
    rounds: [
      makeExtremeRound(countries, flexibleRegions[0], rng),
      makeHigherLowerRound(countries, flexibleRegions[1], rng),
      makeCommonNeighborRound(countries, commonNeighborRegion, rng),
      makeOddOneOutRound(countries, oddOneOutRegion, rng),
      makeNorthToSouthRound(countries, flexibleRegions[2], rng),
    ],
  };
}

export function buildGeoChallengeDuelGame(rng: RandomSource = Math.random): GeoChallengeGame {
  const catalog = loadGeoChallengeCatalog();
  const firstLeg = buildGeoChallengeGameFromCountries(catalog, catalog.countries, rng);
  const usedCountryIds = new Set(firstLeg.rounds.flatMap((round) => round.involvedCountryIds));
  const remainingCountries = catalog.countries.filter((country) => !usedCountryIds.has(country.iso2));
  const secondLeg = buildGeoChallengeGameFromCountries(catalog, remainingCountries, rng);

  const firstRounds = shuffle(firstLeg.rounds, rng);
  let secondRounds = shuffle(secondLeg.rounds, rng);
  if (secondRounds[0].kind === firstRounds[firstRounds.length - 1].kind) {
    secondRounds = [...secondRounds.slice(1), secondRounds[0]];
  }

  return {
    gameId: randomUUID(),
    timePerRound: TIME_PER_ROUND,
    dataVersion: catalog.version,
    dataUpdatedAt: catalog.generatedAt,
    rounds: [...firstRounds, ...secondRounds],
  };
}

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
