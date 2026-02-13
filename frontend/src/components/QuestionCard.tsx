import { Question } from '../types';
import { useTranslation } from 'react-i18next';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
}

export function QuestionCard({ question, questionNumber, totalQuestions }: QuestionCardProps) {
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
        return 'bg-green-900 text-green-300';
      case 'HARD':
        return 'bg-red-900 text-red-300';
      default:
        return 'bg-yellow-900 text-yellow-300';
    }
  };

  const getDifficultyKey = () => {
    const difficulty = question.difficulty?.toLowerCase() || 'medium';
    return `game.difficulty.${difficulty}`;
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
      {/* Progress indicator */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">
          {t('game.questionOf', { current: questionNumber, total: totalQuestions })}
        </span>
        <span className="text-2xl">{getCategoryIcon()}</span>
      </div>

      {/* Question content */}
      <div className="text-center">
        {/* Image for flag or silhouette questions */}
        {question.imageUrl && (question.category === 'FLAG' || question.category === 'SILHOUETTE') && (
          <div className="mb-6">
            <img
              src={question.imageUrl}
              alt="Question image"
              loading="lazy"
              width={question.category === 'FLAG' ? 320 : 160}
              height={question.category === 'FLAG' ? 128 : 160}
              className={`mx-auto ${
                question.category === 'FLAG'
                  ? 'h-32 w-auto rounded shadow-lg border border-gray-700'
                  : 'h-40 w-auto filter invert'
              }`}
              onError={(e) => {
                // Hide broken images
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Question text */}
        <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
          {getQuestionText()}
        </h2>

        {/* Difficulty indicator */}
        {question.difficulty && (
          <div className="mt-4">
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getDifficultyClass()}`}>
              {t(getDifficultyKey())}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
