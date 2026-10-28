import type { TFunction } from 'i18next';
import type { AnswerResult } from '../types';

export type ScoreBreakdownKey = 'basePoints' | 'timeBonus' | 'comboBonus' | 'accuracyBonus';

export interface ScoreBreakdownPart {
  key: ScoreBreakdownKey;
  value: number;
  label: string;
}

/**
 * Builds the visible breakdown of a single answer from the fields the server
 * already returns. Parts worth zero are omitted so a wrong answer never shows
 * a misleading "0 base + 0 speed" line.
 */
export function getScoreBreakdownParts(
  result: AnswerResult | null | undefined,
  t: TFunction,
): ScoreBreakdownPart[] {
  const parts: ScoreBreakdownPart[] = [
    { key: 'basePoints', value: result?.basePoints ?? 0, label: t('game.scoreBreakdownBase') },
    { key: 'timeBonus', value: result?.timeBonus ?? 0, label: t('game.scoreBreakdownTime') },
    { key: 'comboBonus', value: result?.comboBonus ?? 0, label: t('game.scoreBreakdownCombo') },
    { key: 'accuracyBonus', value: result?.accuracyBonus ?? 0, label: t('game.scoreBreakdownAccuracy') },
  ];
  return parts.filter((part) => part.value > 0);
}

export function formatScoreBreakdown(parts: readonly ScoreBreakdownPart[]): string | null {
  if (parts.length === 0) return null;
  return parts.map((part) => `${part.value} ${part.label}`).join(' + ');
}
