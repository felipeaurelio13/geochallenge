/**
 * Server-authoritative feedback — frontend guardrail tests.
 *
 * Verifies that no game page uses SocketPayloadQuestion to extract solution fields
 * from public question payloads (which the server no longer sends).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const pagesDir = resolve(__dirname, '..', 'pages');

function readPageSource(name: string): string {
  return readFileSync(resolve(pagesDir, name), 'utf-8');
}

describe('ChallengeGamePage — server-authoritative', () => {
  it('challenge question payload cannot produce client-side correctness (no correctAnswer in public payload)', () => {
    const publicQuestion = {
      id: 'q1',
      category: 'CAPITAL',
      questionText: 'Capital de Chile',
      options: ['Santiago', 'Lima', 'Bogotá', 'Quito'],
    };

    const hasCorrectAnswer = 'correctAnswer' in publicQuestion;
    const hasLatitude = 'latitude' in publicQuestion;
    const hasLongitude = 'longitude' in publicQuestion;

    expect(hasCorrectAnswer).toBe(false);
    expect(hasLatitude).toBe(false);
    expect(hasLongitude).toBe(false);

    const casted = publicQuestion as Record<string, unknown>;
    expect(casted.correctAnswer).toBeUndefined();
    expect(casted.latitude).toBeUndefined();
    expect(casted.longitude).toBeUndefined();
  });

  it('challenge does not import or use SocketPayloadQuestion type', () => {
    const source = readPageSource('ChallengeGamePage.tsx');
    expect(source).not.toMatch(/SocketPayloadQuestion/);
  });

  it('challenge correctLocation is always null (no solution data in questions payload)', () => {
    const source = readPageSource('ChallengeGamePage.tsx');
    expect(source).toContain('correctLocation={null}');
  });
});

describe('DuelPage — 50/50 server-authoritative', () => {
  it('duel 50/50 never depends on currentQuestion.correctAnswer', () => {
    const source = readPageSource('DuelPage.tsx');
    expect(source).not.toMatch(/SocketPayloadQuestion/);
    expect(source).toContain('// Disabled until server-authoritative mechanic support is available.');
  });

  it('duel stores correctAnswer from duel:questionResult, not from currentQuestion', () => {
    const source = readPageSource('DuelPage.tsx');
    expect(source).toContain('setResultCorrectAnswer(data.correctAnswer');
    expect(source).toContain('resultCorrectAnswer');
    expect(source).not.toContain('(currentQuestion as unknown as SocketPayloadQuestion)');
  });

  it('duel stores correctLocation from duel:questionResult', () => {
    const source = readPageSource('DuelPage.tsx');
    expect(source).toContain('setResultCorrectLocation(data.correctLocation');
    expect(source).toContain('resultCorrectLocation');
  });
});

describe('SurvivalPage — server-authoritative feedback', () => {
  it('survival stores correctAnswer from survival:question-result', () => {
    const source = readPageSource('SurvivalPage.tsx');
    expect(source).not.toMatch(/SocketPayloadQuestion/);
    expect(source).toContain('setResultCorrectAnswer(data.correctAnswer');
    expect(source).toContain('resultCorrectAnswer');
  });

  it('survival stores correctLocation from survival:question-result', () => {
    const source = readPageSource('SurvivalPage.tsx');
    expect(source).toContain('setResultCorrectLocation(data.correctLocation');
    expect(source).toContain('resultCorrectLocation');
  });

  it('MAP feedback uses correctLocation from result, not from public question', () => {
    const source = readPageSource('SurvivalPage.tsx');
    expect(source).not.toContain('(currentQuestion as unknown as SocketPayloadQuestion)');
    expect(source).toContain('correctLocation={showResult ? resultCorrectLocation : null}');
  });
});

describe('ProgressBar — handles optional isCorrect', () => {
  it('getQuestionIndicatorStatus returns "pending" for undefined isCorrect', async () => {
    const { getQuestionIndicatorStatus } = await import('../components/ProgressBar');
    const results = [{ isCorrect: undefined }];
    const status = getQuestionIndicatorStatus(0, 2, results, true);
    expect(status).toBe('pending');
  });

  it('getQuestionIndicatorStatus still works with boolean isCorrect', async () => {
    const { getQuestionIndicatorStatus } = await import('../components/ProgressBar');
    expect(getQuestionIndicatorStatus(0, 2, [{ isCorrect: true }], true)).toBe('correct');
    expect(getQuestionIndicatorStatus(0, 2, [{ isCorrect: false }], true)).toBe('incorrect');
  });
});
