import type { Question } from '../types';

type Lang = 'es' | 'en';

const SUBREGION_ES: Record<string, string> = {
  'Eastern Africa': 'África Oriental',
  'Western Africa': 'África Occidental',
  'Northern Africa': 'África del Norte',
  'Southern Africa': 'África del Sur',
  'Middle Africa': 'África Central',
  'Eastern Europe': 'Europa del Este',
  'Western Europe': 'Europa del Oeste',
  'Northern Europe': 'Europa del Norte',
  'Southern Europe': 'Europa del Sur',
  'Central Europe': 'Europa Central',
  'Eastern Asia': 'Asia Oriental',
  'South-Eastern Asia': 'Asia Suroriental',
  'Southern Asia': 'Asia Meridional',
  'Central Asia': 'Asia Central',
  'Western Asia': 'Asia Occidental',
  'Caribbean': 'el Caribe',
  'Central America': 'América Central',
  'South America': 'América del Sur',
  'Northern America': 'América del Norte',
  'Australia and New Zealand': 'Australia y Nueva Zelanda',
  'Melanesia': 'Melanesia',
  'Micronesia': 'Micronesia',
  'Polynesia': 'Polinesia',
};

const CONTINENT_ES: Record<string, string> = {
  Africa: 'África',
  Europe: 'Europa',
  Asia: 'Asia',
  'North America': 'América del Norte',
  'South America': 'América del Sur',
  Oceania: 'Oceanía',
  Antarctica: 'Antártida',
};

const POP_TIER_ES: Record<string, string> = {
  MEGA: 'uno de los países más poblados del mundo',
  VERY_LARGE: 'un país muy poblado',
  MICRO: 'un microestado con muy poca población',
  VERY_SMALL: 'un país con poca población',
};

const POP_TIER_EN: Record<string, string> = {
  MEGA: 'one of the most populous countries in the world',
  VERY_LARGE: 'a very populous country',
  MICRO: 'a microstate with a very small population',
  VERY_SMALL: 'a country with a small population',
};

function getCountryName(q: Question): string | null {
  if (q.category === 'FLAG' || q.category === 'SILHOUETTE') {
    return q.correctAnswer;
  }
  if (q.category === 'CAPITAL' || q.category === 'MAP') {
    if (typeof q.questionData === 'string') return q.questionData;
    if (q.questionData && typeof q.questionData === 'object') {
      return (q.questionData as { country?: string }).country ?? null;
    }
  }
  return null;
}

export function generateFunFact(q: Question, lang: Lang): string | null {
  if (q.category === 'MONUMENT' || q.category === 'CINEMA_GEO') return null;

  const country = getCountryName(q);
  if (!country) return null;

  const location =
    (lang === 'es'
      ? SUBREGION_ES[q.subregion ?? ''] ?? CONTINENT_ES[q.continent ?? '']
      : q.subregion ?? q.continent) ?? null;

  const popContext =
    lang === 'es'
      ? POP_TIER_ES[q.populationTier ?? '']
      : POP_TIER_EN[q.populationTier ?? ''];

  if (lang === 'es') {
    if (q.isInsular && location) return `${country} es una nación insular de ${location}.`;
    if (q.isInsular) return `${country} es una nación insular.`;
    if (q.isLandlocked && location) return `${country} no tiene salida al mar y está en ${location}.`;
    if (q.isLandlocked) return `${country} no tiene salida al mar.`;
    if (location && popContext) return `${country} es ${popContext}, ubicado en ${location}.`;
    if (location) return `${country} se encuentra en ${location}.`;
    if (popContext) return `${country} es ${popContext}.`;
    return null;
  }

  // English
  if (q.isInsular && location) return `${country} is an island nation in ${location}.`;
  if (q.isInsular) return `${country} is an island nation.`;
  if (q.isLandlocked && location) return `${country} is landlocked, located in ${location}.`;
  if (q.isLandlocked) return `${country} is a landlocked country.`;
  if (location && popContext) return `${country} is ${popContext}, located in ${location}.`;
  if (location) return `${country} is located in ${location}.`;
  if (popContext) return `${country} is ${popContext}.`;
  return null;
}
