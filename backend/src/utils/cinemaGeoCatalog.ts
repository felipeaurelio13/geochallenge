/**
 * Cinema & Geography catalog (v2 schema).
 *
 * Every approved question follows a single unified mechanic: "Where was this scene filmed?".
 * The answer is always a place (country, city, or venue), never a movie title — so showing the
 * movie title as visual context is never a spoiler.
 *
 * v1 (movie_card/visual_strategy/multi_type) is gone. See data/cinema/README.md for the curated
 * authoring flow.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export type AnswerKind = 'country' | 'city' | 'venue';
export type ReviewStatus = 'approved' | 'needs_sources' | 'rejected';
export type CinemaGeoConfidence = 'high' | 'medium' | 'low';

export interface CinemaGeoMovie {
  title: string;
  year: number;
  franchise?: string;
}

export interface CinemaGeoAnswer {
  value: string;          // the actual correct answer text
  country?: string;       // metadata: country where filmed (drives geographic filters)
  city?: string;
  realLocation?: string;  // e.g. "Burj Khalifa", "Hobbiton Movie Set"
  lat?: number;
  lng?: number;
  continent?: string;
}

export interface CinemaGeoSource {
  sourceUrl: string;
  claim: string;
}

export interface CinemaGeoQuestion {
  id: string;
  answerKind: AnswerKind;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  movie: CinemaGeoMovie;
  answer: CinemaGeoAnswer;
  options: string[];                     // exactly 4 strings, includes answer.value
  prompt: { es: string; en: string };
  sources: CinemaGeoSource[];
  confidence: CinemaGeoConfidence;
  reviewStatus: ReviewStatus;
}

interface CinemaGeoCatalogFile {
  _meta?: { version?: number; schema?: string; description?: string; mechanic?: string };
  questions: unknown[];                  // unknown — see typeguard below
}

const CATALOG_PATH = join(__dirname, '../../../data/cinema/cinema-geo-questions.json');

/** Narrow check: is this object a v2 question? Non-v2 entries (needs_sources stubs) lack required fields. */
function isV2Question(q: unknown): q is CinemaGeoQuestion {
  if (!q || typeof q !== 'object') return false;
  const x = q as Record<string, unknown>;
  return (
    typeof x.id === 'string' &&
    (x.answerKind === 'country' || x.answerKind === 'city' || x.answerKind === 'venue') &&
    typeof x.answer === 'object' && x.answer !== null && typeof (x.answer as { value?: unknown }).value === 'string' &&
    Array.isArray(x.options) &&
    typeof x.prompt === 'object' && x.prompt !== null
  );
}

function parseCatalog(): unknown[] {
  const raw = readFileSync(CATALOG_PATH, 'utf-8');
  const payload = JSON.parse(raw) as CinemaGeoCatalogFile;
  if (!Array.isArray(payload.questions)) {
    throw new Error('Formato inválido en data/cinema/cinema-geo-questions.json: falta campo "questions"');
  }
  return payload.questions;
}

/** Returns only approved v2 questions — the only ones eligible for seeding. */
export function loadCinemaGeoCatalog(): CinemaGeoQuestion[] {
  return parseCatalog()
    .filter(isV2Question)
    .filter((q) => q.reviewStatus === 'approved');
}

/** Returns every entry that parses as v2 (any reviewStatus). Used by the validator. */
export function loadFullCinemaGeoCatalog(): CinemaGeoQuestion[] {
  return parseCatalog().filter(isV2Question);
}
