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
