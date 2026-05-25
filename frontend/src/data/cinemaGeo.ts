/**
 * Cinema & Geography frontend payload helpers (v2).
 *
 * The backend stores per-question metadata as JSON in Question.questionData; the frontend
 * reads it here to render the bilingual prompt and the movie card context.
 *
 * The mechanic is "where was this scene filmed?" — answer is always a place (country/city/venue),
 * so showing the movie title in the context card is never a spoiler.
 */
export type CinemaGeoAnswerKind = 'country' | 'city' | 'venue';
export type CinemaGeoLanguage = 'en' | 'es';

export interface CinemaGeoPayload {
  id: string;
  answerKind: CinemaGeoAnswerKind;
  prompt: { es: string; en: string };
  movieTitle: string;
  movieYear: number;
}

export function resolveCinemaGeoLanguage(rawLang: string | undefined | null): CinemaGeoLanguage {
  if (!rawLang) return 'es';
  return rawLang.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function parseCinemaGeoQuestionData(data: unknown): CinemaGeoPayload | null {
  if (!data || typeof data !== 'string') return null;
  try {
    const parsed = JSON.parse(data) as Partial<CinemaGeoPayload> & { prompt?: unknown };
    if (
      typeof parsed.id === 'string' &&
      typeof parsed.prompt === 'object' &&
      parsed.prompt !== null &&
      typeof (parsed.prompt as { es?: unknown }).es === 'string'
    ) {
      const p = parsed.prompt as { es: string; en?: string };
      return {
        id: parsed.id,
        answerKind: (parsed.answerKind as CinemaGeoAnswerKind) ?? 'venue',
        prompt: { es: p.es, en: p.en ?? p.es },
        movieTitle: typeof parsed.movieTitle === 'string' ? parsed.movieTitle : '',
        movieYear: typeof parsed.movieYear === 'number' ? parsed.movieYear : 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}
