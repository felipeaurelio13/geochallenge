import { useLocalStorage } from './useLocalStorage';
import type { GameFilters } from '../types';

const STORAGE_KEY = 'geochallenge:game-filters';

export function useGameFilters() {
  const [filters, setFilters] = useLocalStorage<GameFilters>(STORAGE_KEY, {});

  function clearFilters() {
    setFilters({});
  }

  return { filters, setFilters, clearFilters };
}
