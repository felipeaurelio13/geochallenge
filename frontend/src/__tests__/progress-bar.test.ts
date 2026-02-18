import { describe, expect, it } from 'vitest';
import { getQuestionIndicatorStatus } from '../components/ProgressBar';

describe('ProgressBar question status mapping', () => {
  it('marks each answered question according to its own result', () => {
    const results = [{ isCorrect: false }, { isCorrect: true }];

    expect(getQuestionIndicatorStatus(0, 3, results)).toBe('incorrect');
    expect(getQuestionIndicatorStatus(1, 3, results)).toBe('correct');
  });

  it('keeps the current unanswered question in pending color state while not answered', () => {
    const results = [{ isCorrect: true }, { isCorrect: false }, { isCorrect: false }];

    expect(getQuestionIndicatorStatus(3, 4, results, false)).toBe('current');
  });

  it('shows current question result only after confirmation', () => {
    const results = [{ isCorrect: true }, { isCorrect: false }, { isCorrect: true }];

    expect(getQuestionIndicatorStatus(2, 3, results, true)).toBe('correct');
  });

  it('marks pending questions correctly', () => {
    const results = [{ isCorrect: true }];

    expect(getQuestionIndicatorStatus(2, 1, results)).toBe('pending');
  });
});
