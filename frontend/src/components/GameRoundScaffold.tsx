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
  actionTray,
  rootClassName = 'h-[100vh] h-[100dvh] min-h-0 bg-gray-900 flex flex-col overflow-hidden',
  mainClassName = 'flex-1 min-h-0 overflow-hidden px-3 pt-1 pb-[5.15rem] sm:px-4 sm:pt-1.5 sm:pb-[5.6rem]',
  optionsGridClassName = 'grid gap-2 sm:gap-2.5 grid-cols-2',
}: GameRoundScaffoldProps) {
  return (
    <div className={rootClassName}>
      {header}
      {progress}

      <main className={mainClassName}>
        <div className="mx-auto flex h-full w-full max-w-4xl min-h-0 flex-col">
          {/* min-h-0 + flex-1 permite que este bloque se encoja dentro del layout y solo haga scroll si realmente no cabe. */}
          <div className="flex min-h-0 flex-1 flex-col justify-between gap-1.5 overflow-hidden">
            <div className="shrink-0">
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
              <div className={`min-h-0 ${optionsGridClassName}`}>
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
        </div>
      </main>

      {actionTray}
    </div>
  );
}
