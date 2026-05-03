import { readFileSync } from 'fs';
import { join } from 'path';

export type MonumentDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface MonumentAttribution {
  author: string;
  license: string;
  sourceUrl: string;
}

export interface MonumentRecord {
  slug: string;
  name: { en: string; es: string };
  country: string;
  continent: string;
  latitude: number;
  longitude: number;
  imageUrl: string;
  attribution: MonumentAttribution;
  difficulty: MonumentDifficulty;
}

interface MonumentCatalogPayload {
  _meta?: { version?: number };
  monuments: MonumentRecord[];
}

const CATALOG_PATH = join(__dirname, '../../../data/monuments.json');

export function loadMonumentCatalog(): MonumentRecord[] {
  const payload = JSON.parse(readFileSync(CATALOG_PATH, 'utf-8')) as MonumentCatalogPayload;
  if (!Array.isArray(payload.monuments)) {
    throw new Error('Formato inválido en data/monuments.json (falta el array "monuments")');
  }
  return payload.monuments;
}
