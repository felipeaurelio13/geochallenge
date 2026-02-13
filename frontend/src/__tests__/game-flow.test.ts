import { describe, expect, it } from 'vitest';
import { getPostAnswerHintKey } from '../utils/gameFlow';

describe('game flow helper copy', () => {
  it('returns next hint key for non-final questions', () => {
    expect(getPostAnswerHintKey(false)).toBe('game.tapNextHint');
  });

  it('returns results hint key for final question', () => {
    expect(getPostAnswerHintKey(true)).toBe('game.tapResultsHint');
  });
});
