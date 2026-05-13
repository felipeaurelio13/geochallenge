import type { Difficulty } from '../types';

export const CONTINENTS: readonly { id: string; icon: string }[] = [
  { id: 'Africa', icon: '🌍' },
  { id: 'Europe', icon: '🇪🇺' },
  { id: 'Asia', icon: '🌏' },
  { id: 'North America', icon: '🌎' },
  { id: 'South America', icon: '🌎' },
  { id: 'Oceania', icon: '🌊' },
] as const;

export const CONTINENT_IDS = CONTINENTS.map((c) => c.id);

export const DIFFICULTIES: readonly { id: Difficulty; icon: string }[] = [
  { id: 'EASY', icon: '😊' },
  { id: 'MEDIUM', icon: '🎯' },
  { id: 'HARD', icon: '🔥' },
] as const;

export const DIFFICULTY_IDS = DIFFICULTIES.map((d) => d.id);
