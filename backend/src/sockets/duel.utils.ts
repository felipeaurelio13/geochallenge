import type { AnswerResult } from '../services/game.service.js';
import { getMechanicsConfigForMode } from '../services/game.service.js';
import { config } from '../config/env.js';

export type DuelModeSummary = {
  mode: 'classic' | 'geo-challenge';
};

export type DuelTimingSummary = DuelModeSummary & {
  questionStartedAt?: Date;
};

export type DuelRankedAnswerSummary = {
  rated: boolean;
  currentQuestionIndex: number;
};

export type DuelAnswerPlayerSummary = {
  answers: unknown[];
};

export function duelTimeLimit(duel: DuelModeSummary): number {
  return duel.mode === 'geo-challenge' ? 25 : config.game.timePerQuestion;
}

export function getAuthoritativeDuelTimeRemaining(
  duel: DuelTimingSummary,
  nowMs = Date.now()
): number {
  if (!duel.questionStartedAt) return 0;

  const elapsedSeconds = Math.max(0, (nowMs - duel.questionStartedAt.getTime()) / 1000);
  return Math.max(0, duelTimeLimit(duel) - elapsedSeconds);
}

export function duelMechanics(duel: DuelModeSummary & { rated: boolean }) {
  if (duel.rated) {
    return { enabled: false, allowed: [], limits: {} };
  }

  return duel.mode === 'classic'
    ? getMechanicsConfigForMode('duel')
    : { enabled: false, allowed: [], limits: {} };
}

export function hasAnsweredCurrentDuelQuestion(
  duel: DuelRankedAnswerSummary,
  player: DuelAnswerPlayerSummary
): boolean {
  return player.answers.length >= duel.currentQuestionIndex + 1;
}

export function shouldRejectRankedRepeatAnswer(
  duel: DuelRankedAnswerSummary,
  player: DuelAnswerPlayerSummary
): boolean {
  return duel.rated && hasAnsweredCurrentDuelQuestion(duel, player);
}

export function shouldAutoCloseQuestion(
  duelStatus: 'waiting' | 'countdown' | 'playing' | 'finalizing' | 'finished',
  scheduledQuestionIndex: number,
  currentQuestionIndex: number,
  resolvingQuestionIndex?: number
): boolean {
  return (
    duelStatus === 'playing' &&
    scheduledQuestionIndex === currentQuestionIndex &&
    resolvingQuestionIndex !== scheduledQuestionIndex
  );
}

export function shouldResolveQuestion(
  duelStatus: 'waiting' | 'countdown' | 'playing' | 'finalizing' | 'finished',
  questionIndex: number,
  currentQuestionIndex: number,
  resolvingQuestionIndex?: number
): boolean {
  return (
    duelStatus === 'playing' &&
    questionIndex === currentQuestionIndex &&
    resolvingQuestionIndex !== questionIndex
  );
}

export function shouldForceStartDuel(
  duelStatus: 'waiting' | 'countdown' | 'playing' | 'finalizing' | 'finished',
  readyPlayersCount: number,
  totalPlayers: number,
  elapsedMs: number,
  readyTimeoutMs: number
): boolean {
  return (
    duelStatus === 'waiting' &&
    readyPlayersCount < totalPlayers &&
    totalPlayers > 1 &&
    elapsedMs >= readyTimeoutMs
  );
}

interface DuelPlayerSummary {
  userId: string;
  score: number;
  answers: Array<{ timeRemaining?: number }>;
}

export function determineDuelWinner(players: [DuelPlayerSummary, DuelPlayerSummary]): string | null {
  const [a, b] = players;

  if (a.score !== b.score) {
    return a.score > b.score ? a.userId : b.userId;
  }

  const aTimeBank = a.answers.reduce((acc, ans) => acc + (ans.timeRemaining ?? 0), 0);
  const bTimeBank = b.answers.reduce((acc, ans) => acc + (ans.timeRemaining ?? 0), 0);

  if (aTimeBank !== bTimeBank) {
    return aTimeBank > bTimeBank ? a.userId : b.userId;
  }

  return null;
}

export function createUnansweredResult(questionId: string): AnswerResult {
  return {
    questionId,
    isCorrect: false,
    correctAnswer: '',
    userAnswer: '',
    points: 0,
    timeRemaining: 0,
  };
}
