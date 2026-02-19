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
  rootClassName = 'min-h-screen bg-gray-900 flex flex-col overflow-x-hidden',
  mainClassName = 'flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-2 pb-28 sm:px-4 sm:py-4 sm:pb-8',
  optionsGridClassName = 'grid gap-2.5 sm:gap-3 grid-cols-2',
}: GameRoundScaffoldProps) {
  return (
    <div className={rootClassName}>
      {header}
      {progress}

      <main className={mainClassName}>
        <div className="max-w-4xl mx-auto flex flex-col">
          <QuestionCard
            question={question}
            questionNumber={questionNumber}
            totalQuestions={totalQuestions}
            compact={compactQuestionCard}
          />

          <div className="mt-2.5">
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
          </div>

          {contextHint && !showResult && (
            <div className="mt-2.5 rounded-2xl border border-gray-700 bg-gray-800/60 px-4 py-2.5">
              <p className="text-base leading-relaxed text-gray-100" aria-live="polite">
                {contextHint}
              </p>
              {Boolean(isLowTime && lowTimeHint) && (
                <p className="mt-2 text-sm font-semibold text-amber-300" aria-live="assertive">
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
