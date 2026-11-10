import { describe, expect, it } from 'vitest';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../controllers/auth.controller';
import {
  answerSchema as flagMasterAnswerSchema,
  finishSchema as flagMasterFinishSchema,
} from '../controllers/flagMaster.controller';
import {
  answerSchema as geoChallengeAnswerSchema,
  finishSchema as geoChallengeFinishSchema,
} from '../controllers/geoChallenge.controller';

describe('auth schemas validation and bounded collections', () => {
  it('validates correct registration data', () => {
    const valid = registerSchema.safeParse({
      username: 'explorer_99',
      email: 'explorer@example.com',
      password: 'password123',
    });
    expect(valid.success).toBe(true);
  });

  it('rejects oversized email to prevent ReDoS / memory exhaustion', () => {
    const oversizedEmail = `${'a'.repeat(250)}@example.com`;
    const result = registerSchema.safeParse({
      username: 'explorer_99',
      email: oversizedEmail,
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects oversized password on login to prevent bcrypt DoS', () => {
    const valid = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(valid.success).toBe(true);

    const oversized = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'a'.repeat(200),
    });
    expect(oversized.success).toBe(false);
  });

  it('bounds forgotPassword and resetPassword schemas', () => {
    const forgotValid = forgotPasswordSchema.safeParse({ email: 'valid@example.com' });
    expect(forgotValid.success).toBe(true);

    const forgotOversized = forgotPasswordSchema.safeParse({ email: `${'b'.repeat(250)}@ex.com` });
    expect(forgotOversized.success).toBe(false);

    const resetValid = resetPasswordSchema.safeParse({
      token: 'validtoken123',
      newPassword: 'newsecurepass',
    });
    expect(resetValid.success).toBe(true);

    const resetOversized = resetPasswordSchema.safeParse({
      token: 'x'.repeat(300),
      newPassword: 'newsecurepass',
    });
    expect(resetOversized.success).toBe(false);
  });
});

describe('flag master and geo challenge schema bounds', () => {
  it('bounds flag master answer and finish schemas', () => {
    const validAnswer = flagMasterAnswerSchema.safeParse({
      gameId: 'game-123',
      questionId: 'q-1',
      answer: 'Chile',
      timeRemaining: 5,
    });
    expect(validAnswer.success).toBe(true);

    const oversizedAnswer = flagMasterAnswerSchema.safeParse({
      gameId: 'game-123',
      questionId: 'q-1',
      answer: 'x'.repeat(250),
      timeRemaining: 5,
    });
    expect(oversizedAnswer.success).toBe(false);

    const validFinish = flagMasterFinishSchema.safeParse({
      gameId: 'game-123',
      answers: [{ questionId: 'q-1', answer: 'Chile', timeRemaining: 5 }],
    });
    expect(validFinish.success).toBe(true);

    const oversizedAnswersList = flagMasterFinishSchema.safeParse({
      gameId: 'game-123',
      answers: Array.from({ length: 25 }, (_, i) => ({
        questionId: `q-${i}`,
        answer: 'Chile',
        timeRemaining: 5,
      })),
    });
    expect(oversizedAnswersList.success).toBe(false);
  });

  it('bounds geo challenge answer and finish schemas', () => {
    const validAnswer = geoChallengeAnswerSchema.safeParse({
      sessionToken: 'token123',
      roundId: 'r-1',
      selectedOptionIds: ['opt-1'],
    });
    expect(validAnswer.success).toBe(true);

    const tooManyOptions = geoChallengeAnswerSchema.safeParse({
      sessionToken: 'token123',
      roundId: 'r-1',
      selectedOptionIds: ['opt-1', 'opt-2', 'opt-3', 'opt-4', 'opt-5'],
    });
    expect(tooManyOptions.success).toBe(false);

    const oversizedAnswers = geoChallengeFinishSchema.safeParse({
      sessionToken: 'token123',
      answers: Array.from({ length: 15 }, (_, i) => ({
        roundId: `r-${i}`,
        selectedOptionIds: ['opt-1'],
      })),
    });
    expect(oversizedAnswers.success).toBe(false);
  });
});
