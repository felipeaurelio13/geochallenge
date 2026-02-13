import { describe, expect, it } from 'vitest';
import { pickCategoryQuestionIds, pickMixedQuestionIds } from '../services/game.service.js';

describe('game service random selection', () => {
  it('returns unique ids and respects requested count in mixed mode', () => {
    const flagIds = ['f1', 'f2', 'f3'];
    const capitalIds = ['c1', 'c2', 'c3'];
    const mapIds = ['m1', 'm2', 'm3'];
    const silhouetteIds = ['s1', 's2', 's3'];

    const selected = pickMixedQuestionIds([flagIds, capitalIds, mapIds, silhouetteIds], 8);

    expect(selected).toHaveLength(8);
    expect(new Set(selected).size).toBe(8);

    const selectedByCategory = {
      flag: selected.filter((id) => flagIds.includes(id)).length,
      capital: selected.filter((id) => capitalIds.includes(id)).length,
      map: selected.filter((id) => mapIds.includes(id)).length,
      silhouette: selected.filter((id) => silhouetteIds.includes(id)).length,
    };

    expect(selectedByCategory.flag).toBeGreaterThan(0);
    expect(selectedByCategory.capital).toBeGreaterThan(0);
    expect(selectedByCategory.map).toBeGreaterThan(0);
    expect(selectedByCategory.silhouette).toBeGreaterThan(0);
  });

  it('does not exceed available ids when requesting more than pool size', () => {
    const selected = pickCategoryQuestionIds(['q1', 'q2', 'q3'], 10);

    expect(selected).toHaveLength(3);
    expect(new Set(selected).size).toBe(3);
  });
});
