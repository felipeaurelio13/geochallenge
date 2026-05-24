/**
 * MOVIE_SCENE is a legacy enum name.
 * Product-facing category is "Cinema & Geography": questions require film-production
 * or cinematic-location knowledge, not generic place recognition.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

export type CinemaGeoQuestionType =
  | 'movie_from_sequence_location'
  | 'sequence_location'
  | 'fiction_vs_real_location'
  | 'represented_vs_filmed'
  | 'movie_from_filming_map'
  | 'film_from_iconic_set'
  | 'odd_one_out';

export type VisualStrategy = 'none' | 'movie_card' | 'iconic_location' | 'map' | 'generic_cinema';

export type ReviewStatus = 'approved' | 'needs_sources' | 'rejected';

export type CinemaGeoConfidence = 'high' | 'medium' | 'low';

export interface CinemaGeoVisual {
  strategy: VisualStrategy;
  assetId?: string;
  url?: string;
  sourceUrl?: string;
  license?: string;
  author?: string;
  alt?: { es: string; en: string };
  hintsLevel?: 'none' | 'low' | 'medium' | 'high';
}

export interface CinemaGeoMovie {
  title: string;
  year: number;
  franchise?: string;
}

export interface CinemaGeoContext {
  realLocation?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  continent?: string;
}

export interface CinemaGeoMapPin {
  label: string;
  lat: number;
  lng: number;
}

export interface CinemaGeoSourceClaim {
  claim: string;
  sourceUrl: string;
}

export interface CinemaGeoQuestion {
  id: string;
  type: CinemaGeoQuestionType;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  prompt: { es: string; en: string };
  correctAnswer: string;
  options: string[];
  movie: CinemaGeoMovie;
  geoContext: CinemaGeoContext;
  mapPins?: CinemaGeoMapPin[];
  visual: CinemaGeoVisual;
  sourceClaims?: CinemaGeoSourceClaim[];
  confidence: CinemaGeoConfidence;
  reviewStatus: ReviewStatus;
}

interface CinemaGeoCatalogFile {
  _meta?: { version?: number; description?: string };
  questions: CinemaGeoQuestion[];
}

const CATALOG_PATH = join(__dirname, '../../../data/cinema/cinema-geo-questions.json');

function parseCatalog(): CinemaGeoQuestion[] {
  const raw = readFileSync(CATALOG_PATH, 'utf-8');
  const payload = JSON.parse(raw) as CinemaGeoCatalogFile;
  if (!Array.isArray(payload.questions)) {
    throw new Error('Formato inválido en data/cinema/cinema-geo-questions.json: falta campo "questions"');
  }
  return payload.questions;
}

/** Returns only approved questions — the only ones eligible for seeding. */
export function loadCinemaGeoCatalog(): CinemaGeoQuestion[] {
  return parseCatalog().filter((q) => q.reviewStatus === 'approved');
}

/** Returns all questions regardless of reviewStatus — used by the validator only. */
export function loadFullCinemaGeoCatalog(): CinemaGeoQuestion[] {
  return parseCatalog();
}
