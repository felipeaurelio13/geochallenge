import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { QuestionCard } from './QuestionCard';
import { OptionButton } from './OptionButton';
import { UniversalGameLayout } from './UniversalGameLayout';
import { Question } from '../types';
import { getOptionDisplayLabel } from '../utils/monumentOptions';

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
  /** Respuesta correcta devuelta por el backend para la ronda ya confirmada. */
  correctAnswer?: string;
  onOptionSelect: (option: string) => void;
  showResult: boolean;
  disableOptions?: boolean;
  hiddenOptionIndexes?: number[];
  actionTray: ReactNode;
  rootClassName?: string;
  optionsGridClassName?: string;
  onImageError?: () => void;
  /** true cuando el intento de reemplazo de la pregunta también falló (ver QuestionCard). */
  imageReplacementFailed?: boolean;
  onRetryImage?: () => void;
  onSkipQuestion?: () => void;
  minimalQuestionCard?: boolean;
  feedback?: ReactNode;
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
  correctAnswer,
  onOptionSelect,
  showResult,
  disableOptions = false,
  hiddenOptionIndexes = [],
  actionTray,
  rootClassName,
  optionsGridClassName = 'game-options-grid',
  onImageError,
  imageReplacementFailed = false,
  onRetryImage,
  onSkipQuestion,
  minimalQuestionCard = false,
  feedback,
}: GameRoundScaffoldProps) {
  const { i18n } = useTranslation();
  const isCapitalQuestion = !isMapQuestion && question.category === 'CAPITAL';
  const hasMediaQuestion = !isMapQuestion && (question.category === 'FLAG' || question.category === 'SILHOUETTE' || question.category === 'MONUMENT');

  const content = (
    <div className={`game-round-content mx-auto flex h-full w-full max-w-4xl min-h-0 flex-col ${minimalQuestionCard ? 'perfect-round-content' : ''}`}>
      <div
        className={[
          'game-question-wrap min-h-0',
          // QA round 2 (ROUND2-005): antes CAPITAL usaba `flex-1 items-center`
          // que centraba la pregunta verticalmente y dejaba ~150px de espacio
          // muerto arriba y abajo en mobile. Ahora la pregunta se ancla cerca
          // de las opciones para que queden a tiro de pulgar.
          isCapitalQuestion ? 'game-question-wrap--capital flex items-start pt-2' : '',
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
          onImageError={onImageError}
          replacementFailed={imageReplacementFailed}
          onRetryImage={onRetryImage}
          onSkipQuestion={onSkipQuestion}
          minimal={minimalQuestionCard || isMapQuestion || hasMediaQuestion}
        />
      </div>

      {isMapQuestion ? (
        <div id="game-options" className="min-h-0 flex-1 overflow-hidden">{mapContent}</div>
      ) : (
        <div id="game-options" className="game-options-wrap min-h-0 w-full flex-1 overflow-hidden">
          <div key={questionNumber} className={optionsGridClassName}>
            {question.options.map((option, index) => (
            <OptionButton
              key={`${questionNumber}-${index}`}
              option={option}
              displayLabel={getOptionDisplayLabel(question, option, i18n.language)}
              index={index}
              onClick={() => onOptionSelect(option)}
              disabled={showResult || disableOptions || imageReplacementFailed || hiddenOptionIndexes.includes(index)}
              eliminated={hiddenOptionIndexes.includes(index)}
              selected={selectedAnswer === option}
              isCorrect={showResult && correctAnswer === option}
              showResult={showResult}
            />
            ))}
          </div>
        </div>
      )}
      {feedback ? <div className="perfect-round-feedback" aria-live="polite">{feedback}</div> : null}
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
