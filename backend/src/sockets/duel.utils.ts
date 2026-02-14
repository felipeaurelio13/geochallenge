export function shouldAutoCloseQuestion(
  duelStatus: 'waiting' | 'countdown' | 'playing' | 'finished',
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
  duelStatus: 'waiting' | 'countdown' | 'playing' | 'finished',
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
  duelStatus: 'waiting' | 'countdown' | 'playing' | 'finished',
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
