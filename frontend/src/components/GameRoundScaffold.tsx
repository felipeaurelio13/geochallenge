import { ReactNode } from 'react';
import { QuestionCard } from './QuestionCard';
import { OptionButton } from './OptionButton';
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
  contextHint?: string;
  isLowTime?: boolean;
  lowTimeHint?: string;
  actionTray: ReactNode;
  rootClassName?: string;
  mainClassName?: string;
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
  contextHint,
  isLowTime,
  lowTimeHint,
  actionTray,
  rootClassName = 'h-full min-h-0 bg-gray-900 flex flex-col overflow-x-hidden',
  mainClassName = 'flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+6.7rem)] sm:px-4 sm:py-3 sm:pb-28',
  optionsGridClassName = 'grid gap-2 sm:gap-2.5 grid-cols-2',
}: GameRoundScaffoldProps) {
  return (
    <div className={rootClassName}>
      {header}
      {progress}

      <main className={mainClassName}>
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
          <QuestionCard
            question={question}
            questionNumber={questionNumber}
            totalQuestions={totalQuestions}
            compact={compactQuestionCard}
          />

          {isMapQuestion ? (
            mapContent
          ) : (
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
          )}

          {contextHint && !showResult && (
            <div className="rounded-2xl border border-gray-700 bg-gray-800/60 px-3.5 py-2">
              <p className="text-sm leading-relaxed text-gray-100 sm:text-base" aria-live="polite">
                {contextHint}
              </p>
              {Boolean(isLowTime && lowTimeHint) && (
                <p className="mt-1.5 text-xs font-semibold text-amber-300 sm:text-sm" aria-live="assertive">
                  {lowTimeHint}
                </p>
              )}
            </div>
          )}

          {actionTray}
        </div>
      </main>
    </div>
  );
}
