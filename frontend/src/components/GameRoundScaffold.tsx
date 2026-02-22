import { ReactNode } from 'react';
import { QuestionCard } from './QuestionCard';
import { OptionButton } from './OptionButton';
import { UniversalGameLayout } from './UniversalGameLayout';
import { Question } from '../types';

type GameRoundScaffoldProps = {
  header: ReactNode;
  progress?: ReactNode;
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  compactQuestionCard?: boolean;
  isMapQuestion: boolean;
  mapContent: ReactNode;
  selectedAnswer: string | null;
  onOptionSelect: (option: string) => void;
  showResult: boolean;
  disableOptions?: boolean;
  actionTray: ReactNode;
  rootClassName?: string;
  optionsGridClassName?: string;
};

export function GameRoundScaffold({
  header,
  progress,
  question,
  questionNumber,
  totalQuestions,
  compactQuestionCard = true,
  isMapQuestion,
  mapContent,
  selectedAnswer,
  onOptionSelect,
  showResult,
  disableOptions = false,
  actionTray,
  rootClassName,
  optionsGridClassName = 'game-options-grid',
}: GameRoundScaffoldProps) {
  const isCapitalQuestion = !isMapQuestion && question.category === 'CAPITAL';
  const hasMediaQuestion = !isMapQuestion && (question.category === 'FLAG' || question.category === 'SILHOUETTE');

  const content = (
    <div className="game-round-content mx-auto flex h-full w-full max-w-4xl min-h-0 flex-col">
      <div
        className={[
          'game-question-wrap min-h-0',
          isCapitalQuestion ? 'game-question-wrap--capital flex flex-1 items-center' : '',
          hasMediaQuestion ? 'game-question-wrap--media' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <QuestionCard
          question={question}
          questionNumber={questionNumber}
          totalQuestions={totalQuestions}
          compact={compactQuestionCard}
        />
      </div>

      {isMapQuestion ? (
        <div className="min-h-0 flex-1 overflow-hidden">{mapContent}</div>
      ) : (
        <div className="game-options-wrap min-h-0 w-full flex-1 overflow-y-auto overscroll-contain pr-1">
          <div className={optionsGridClassName}>
            {question.options.map((option, index) => (
            <OptionButton
              key={option}
              option={option}
              index={index}
              onClick={() => onOptionSelect(option)}
              disabled={showResult || disableOptions}
              selected={selectedAnswer === option}
              isCorrect={option === question.correctAnswer}
              showResult={showResult}
            />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <UniversalGameLayout
      className={rootClassName}
      header={header}
      progress={progress}
      content={content}
      footer={actionTray}
    />
  );
}
