import { readFileSync } from 'fs';
import { join } from 'path';

export type SceneDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface SceneAttribution {
  author: string;
  license: string;
  sourceUrl: string;
}

export interface MovieSceneRecord {
  slug: string;
  movie: { en: string; es: string };
  country: string;
  city: string;
  continent: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  attribution: SceneAttribution;
  difficulty: SceneDifficulty;
}

interface MovieSceneCatalogPayload {
  _meta?: { version?: number };
  scenes: MovieSceneRecord[];
}

const CATALOG_PATH = join(__dirname, '../../../data/movie-scenes.json');

export function buildCommonsImageUrl(sourceUrl: string, width = 800): string {
  const fileNameMatch = sourceUrl.match(/\/wiki\/File:(.+)$/);
  if (!fileNameMatch) {
    throw new Error(`sourceUrl inválida para Commons: ${sourceUrl}`);
  }

  const fileName = decodeURIComponent(fileNameMatch[1]);
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=${width}`;
}

export function loadMovieSceneCatalog(): MovieSceneRecord[] {
  const payload = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8')) as MovieSceneCatalogPayload;
  if (!Array.isArray(payload.scenes)) {
    throw new Error('Formato inválido en data/movie-scenes.json (falta el array "scenes")');
  }

  return payload.scenes.map((scene) => ({
    ...scene,
    imageUrl: buildCommonsImageUrl(scene.attribution.sourceUrl),
  }));
}
