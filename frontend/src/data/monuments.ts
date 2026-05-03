import monumentsData from '../../../data/monuments.json';

export type MonumentLanguage = 'en' | 'es';

export interface MonumentAttribution {
  author: string;
  license: string;
  sourceUrl: string;
}

export interface Monument {
  slug: string;
  name: { en: string; es: string };
  country: string;
  continent: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  attribution: MonumentAttribution;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

export const monuments: Monument[] = (monumentsData as { monuments: Monument[] }).monuments;

const bySlug = new Map<string, Monument>();
const byEnName = new Map<string, Monument>();

for (const m of monuments) {
  bySlug.set(m.slug, m);
  byEnName.set(m.name.en.toLowerCase(), m);
}

export function getMonumentBySlug(slug: string): Monument | undefined {
  return bySlug.get(slug);
}

export function getMonumentByEnName(name: string): Monument | undefined {
  if (!name) return undefined;
  return byEnName.get(name.toLowerCase());
}

export function getLocalizedMonumentName(slug: string, lang: MonumentLanguage): string | undefined {
  const m = bySlug.get(slug);
  if (!m) return undefined;
  return m.name[lang] ?? m.name.en;
}

export function resolveLanguage(rawLang: string | undefined | null): MonumentLanguage {
  if (!rawLang) return 'es';
  const normalized = rawLang.toLowerCase();
  if (normalized.startsWith('en')) return 'en';
  return 'es';
}

export interface MonumentVariantPayload {
  slug: string;
  variant: 'identify' | 'country';
}

export function parseMonumentQuestionData(data: unknown): MonumentVariantPayload | null {
  if (!data) return null;
  let raw: string;
  if (typeof data === 'string') {
    raw = data;
  } else if (typeof data === 'object') {
    return null;
  } else {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<MonumentVariantPayload>;
    if (parsed && typeof parsed.slug === 'string' && (parsed.variant === 'identify' || parsed.variant === 'country')) {
      return { slug: parsed.slug, variant: parsed.variant };
    }
    return null;
  } catch {
    return null;
  }
}
