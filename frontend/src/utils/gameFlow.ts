export const getPostAnswerHintKey = (isLastQuestion: boolean): 'game.tapResultsHint' | 'game.tapNextHint' => (
  isLastQuestion ? 'game.tapResultsHint' : 'game.tapNextHint'
);
