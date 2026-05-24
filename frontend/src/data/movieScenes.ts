import movieScenesData from '../../../data/movie-scenes.json';

export type SceneLanguage = 'en' | 'es';

export interface SceneAttribution {
  author: string;
  license: string;
  sourceUrl: string;
}

export interface MovieScene {
  slug: string;
  movie: { en: string; es: string };
  country: string;
  city: string;
  continent: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  attribution: SceneAttribution;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

export const movieScenes: MovieScene[] = (movieScenesData as { scenes: MovieScene[] }).scenes;

const bySlug = new Map<string, MovieScene>();
for (const s of movieScenes) {
  bySlug.set(s.slug, s);
}

export function getMovieSceneBySlug(slug: string): MovieScene | undefined {
  return bySlug.get(slug);
}

export function getLocalizedMovieName(slug: string, lang: SceneLanguage): string | undefined {
  const s = bySlug.get(slug);
  if (!s) return undefined;
  return s.movie[lang] ?? s.movie.en;
}

export function resolveSceneLanguage(rawLang: string | undefined | null): SceneLanguage {
  if (!rawLang) return 'es';
  return rawLang.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export interface MovieSceneVariantPayload {
  slug: string;
  variant: 'country' | 'city';
}

export function parseMovieSceneQuestionData(data: unknown): MovieSceneVariantPayload | null {
  if (!data || typeof data !== 'string') return null;
  try {
    const parsed = JSON.parse(data) as Partial<MovieSceneVariantPayload>;
    if (
      parsed &&
      typeof parsed.slug === 'string' &&
      (parsed.variant === 'country' || parsed.variant === 'city')
    ) {
      return { slug: parsed.slug, variant: parsed.variant };
    }
    return null;
  } catch {
    return null;
  }
}

// --- Cinema & Geography (new prompt-based format) ---

export type CinemaGeoVisualStrategy = 'none' | 'movie_card' | 'iconic_location' | 'map' | 'generic_cinema';

export interface CinemaGeoPayload {
  id: string;
  type: string;
  prompt: { es: string; en: string };
  movieTitle: string;
  movieYear: number;
  visualStrategy: CinemaGeoVisualStrategy;
  assetId?: string | null;
}

/**
 * Detects and parses the new Cinema & Geography question format.
 * New format stores a 'prompt' object (with es/en keys) in questionData.
 * Legacy format stores {slug, variant} — returns null for those.
 */
export function parseCinemaGeoQuestionData(data: unknown): CinemaGeoPayload | null {
  if (!data || typeof data !== 'string') return null;
  try {
    const parsed = JSON.parse(data) as Partial<CinemaGeoPayload> & { prompt?: unknown };
    if (
      parsed &&
      typeof parsed.prompt === 'object' &&
      parsed.prompt !== null &&
      typeof (parsed.prompt as { es?: unknown }).es === 'string'
    ) {
      const p = parsed.prompt as { es: string; en?: string };
      return {
        id: parsed.id ?? '',
        type: parsed.type ?? '',
        prompt: { es: p.es, en: p.en ?? p.es },
        movieTitle: parsed.movieTitle ?? '',
        movieYear: typeof parsed.movieYear === 'number' ? parsed.movieYear : 0,
        visualStrategy: (parsed.visualStrategy as CinemaGeoVisualStrategy) ?? 'none',
        assetId: parsed.assetId ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}
