import { describe, expect, it } from 'vitest';
import { selectRandom } from '../utils/scoring.js';

describe('Random question selection', () => {
  it('should eventually select elements from the entire collection, not only from the start', () => {
    const pool = Array.from({ length: 100 }, (_, i) => i + 1);
    const seen = new Set<number>();

    for (let i = 0; i < 300; i++) {
      const selected = selectRandom(pool, 10);
      selected.forEach((n) => seen.add(n));
    }

    expect(seen.has(100)).toBe(true);
    expect(seen.size).toBeGreaterThan(95);
  });
});
