import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import type { AnswerResult } from '../types';
import { formatScoreBreakdown, getScoreBreakdownParts } from '../utils/scoreBreakdown';

const labels: Record<string, string> = {
  'game.scoreBreakdownBase': 'base',
  'game.scoreBreakdownTime': 'rápido',
  'game.scoreBreakdownCombo': 'racha',
  'game.scoreBreakdownAccuracy': 'precisión',
};
const t = ((key: string) => labels[key] ?? key) as unknown as TFunction;

function result(overrides: Partial<AnswerResult> = {}): AnswerResult {
  return {
    questionId: 'q1',
    isCorrect: true,
    correctAnswer: 'Santiago',
    userAnswer: 'Santiago',
    points: 135,
    ...overrides,
  };
}

describe('score breakdown', () => {
  it('keeps only the components that actually added points', () => {
    const parts = getScoreBreakdownParts(
      result({ basePoints: 100, timeBonus: 35, comboBonus: 0, accuracyBonus: 0 }),
      t,
    );

    expect(parts).toEqual([
      { key: 'basePoints', value: 100, label: 'base' },
      { key: 'timeBonus', value: 35, label: 'rápido' },
    ]);
    expect(formatScoreBreakdown(parts)).toBe('100 base + 35 rápido');
  });

  it('includes the map accuracy component when present', () => {
    const parts = getScoreBreakdownParts(
      result({ basePoints: 0, timeBonus: 20, accuracyBonus: 80 }),
      t,
    );

    expect(formatScoreBreakdown(parts)).toBe('20 rápido + 80 precisión');
  });

  it('returns no breakdown for a wrong answer or missing result', () => {
    expect(getScoreBreakdownParts(result({ isCorrect: false }), t)).toEqual([]);
    expect(getScoreBreakdownParts(null, t)).toEqual([]);
    expect(formatScoreBreakdown([])).toBeNull();
  });
});
