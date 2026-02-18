import { Question } from '../types';
import { useTranslation } from 'react-i18next';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  compact?: boolean;
}

export function QuestionCard({ question, questionNumber, totalQuestions, compact = false }: QuestionCardProps) {
  const { t } = useTranslation();

  // Guard against undefined question
  if (!question) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <div className="text-center text-gray-400">Loading...</div>
      </div>
    );
  }

  const getCategoryIcon = () => {
    switch (question.category) {
      case 'FLAG':
        return '🏳️';
      case 'CAPITAL':
        return '🏛️';
      case 'MAP':
        return '🗺️';
      case 'SILHOUETTE':
        return '🖼️';
      default:
        return '🌍';
    }
  };

  // Get the questionData value - it could be a string or an object
  const getQuestionDataValue = (): string => {
    if (!question.questionData) return '';
    if (typeof question.questionData === 'string') return question.questionData;
    // If it's an object, try to extract relevant field
    return question.questionData.country || question.questionData.capital || '';
  };

  const getQuestionText = () => {
    const dataValue = getQuestionDataValue();

    switch (question.category) {
      case 'FLAG':
        return t('game.questionFlag');
      case 'CAPITAL':
        // For capital questions, questionData contains the country name
        return t('game.questionCapital', { country: dataValue || question.questionText || '' });
      case 'MAP':
        // For map questions, questionData contains the capital/city to find
        return t('game.questionMap', { capital: dataValue || question.questionText || '' });
      case 'SILHOUETTE':
        return t('game.questionSilhouette');
      default:
        return question.questionText || '';
    }
  };

  const getDifficultyClass = () => {
    const difficulty = question.difficulty?.toUpperCase() || 'MEDIUM';
    switch (difficulty) {
      case 'EASY':
        return 'border border-green-500/30 bg-green-500/15 text-green-200';
      case 'HARD':
        return 'border border-red-500/30 bg-red-500/15 text-red-200';
      default:
        return 'border border-amber-500/30 bg-amber-500/15 text-amber-200';
    }
  };

  const getDifficultyKey = () => {
    const difficulty = question.difficulty?.toLowerCase() || 'medium';
    return `game.difficulty.${difficulty}`;
  };

  return (
    <div className={`rounded-3xl border border-gray-700 bg-gray-800/95 shadow-xl shadow-black/25 ${compact ? 'px-4 py-4 sm:px-6 sm:py-6' : 'px-4 py-5 sm:px-6 sm:py-6'}`}>
      {/* Progress indicator */}
      <div className={`flex items-center justify-between ${compact ? 'mb-3' : 'mb-5'}`}>
        <span className={`text-gray-400 ${compact ? 'hidden text-sm sm:inline' : 'text-sm'}`}>
          {t('game.questionOf', { current: questionNumber, total: totalQuestions })}
        </span>
        <span className={`${compact ? 'text-2xl sm:text-3xl' : 'text-3xl'} leading-none`} aria-hidden="true">{getCategoryIcon()}</span>
      </div>

      {/* Question content */}
      <div className="text-center">
        {/* Image for flag or silhouette questions */}
        {question.imageUrl && (question.category === 'FLAG' || question.category === 'SILHOUETTE') && (
          <div className={compact ? 'mb-4' : 'mb-6'}>
            <img
              src={question.imageUrl}
              alt={t('game.questionImageAlt', { category: question.category.toLowerCase() })}
              loading="lazy"
              width={question.category === 'FLAG' ? 360 : 180}
              height={question.category === 'FLAG' ? 180 : 180}
              className={`mx-auto ${
                question.category === 'FLAG'
                  ? `${compact ? 'max-h-36 sm:max-h-52' : 'max-h-52'} w-full max-w-md rounded-xl border border-amber-400/70 bg-black/10 object-contain p-1 shadow-lg shadow-black/30 ring-1 ring-white/10`
                  : `${compact ? 'max-h-28 sm:max-h-48' : 'max-h-48'} w-auto filter invert`
              }`}
              onError={(e) => {
                // Hide broken images
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Question text */}
        <h2 className={`${compact ? 'text-[1.7rem] sm:text-4xl' : 'text-[2rem] sm:text-4xl'} leading-tight font-bold text-white break-words`}>
          {getQuestionText()}
        </h2>

        {/* Difficulty indicator */}
        {question.difficulty && (
          <div className={compact ? 'mt-3' : 'mt-5'}>
            <span className={`inline-block rounded-full px-4 py-1.5 text-sm font-semibold ${getDifficultyClass()}`}>
              {t(getDifficultyKey())}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
