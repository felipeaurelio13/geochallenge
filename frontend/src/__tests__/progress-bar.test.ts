import { describe, expect, it } from 'vitest';
import { getQuestionIndicatorStatus } from '../components/ProgressBar';

describe('ProgressBar question status mapping', () => {
  it('marks each answered question according to its own result', () => {
    const results = [{ isCorrect: false }, { isCorrect: true }];

    expect(getQuestionIndicatorStatus(0, 2, results)).toBe('incorrect');
    expect(getQuestionIndicatorStatus(1, 2, results)).toBe('correct');
  });

  it('marks current and pending questions correctly', () => {
    const results = [{ isCorrect: true }];

    expect(getQuestionIndicatorStatus(1, 1, results)).toBe('current');
    expect(getQuestionIndicatorStatus(2, 1, results)).toBe('pending');
  });
});
