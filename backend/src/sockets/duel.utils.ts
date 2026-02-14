export function shouldAutoCloseQuestion(
  duelStatus: 'waiting' | 'countdown' | 'playing' | 'finished',
  scheduledQuestionIndex: number,
  currentQuestionIndex: number
): boolean {
  return duelStatus === 'playing' && scheduledQuestionIndex === currentQuestionIndex;
}
