import { useMemo, useState } from 'react';
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
  const [hasImageError, setHasImageError] = useState(false);

  const getQuestionDataValue = (): string => {
    if (!question.questionData) return '';
    if (typeof question.questionData === 'string') {
      const trimmedData = question.questionData.trim();

      if (trimmedData.startsWith('{') && trimmedData.endsWith('}')) {
        try {
          const parsedData = JSON.parse(trimmedData) as { country?: string; capital?: string };
          return parsedData.country || parsedData.capital || '';
        } catch {
          // Si no es JSON válido, se usa el valor original.
        }
      }

      return question.questionData;
    }
    return question.questionData.country || question.questionData.capital || '';
  };

  const getFallbackQuestionText = () => {
    const legacyQuestionText = (question as Partial<Question> & { question?: string }).question;
    const dataValue = getQuestionDataValue();

    if (question.questionText?.trim()) return question.questionText;
    if (legacyQuestionText?.trim()) return legacyQuestionText;
    if (question.category === 'CAPITAL') return t('game.questionCapital', { country: dataValue });
    if (question.category === 'MAP') return t('game.questionMap', { capital: dataValue });

    return dataValue;
  };

  const getQuestionText = () => {
    const dataValue = getQuestionDataValue();

    switch (question.category) {
      case 'FLAG':
        return t('game.questionFlag');
      case 'CAPITAL':
        return t('game.questionCapital', { country: dataValue || getFallbackQuestionText() });
      case 'MAP':
        return t('game.questionMap', { capital: dataValue || getFallbackQuestionText() });
      case 'SILHOUETTE':
        return t('game.questionSilhouette');
      default:
        return getFallbackQuestionText();
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

  const normalizedImageUrl = useMemo(() => {
    if (!question.imageUrl) return '';

    if (question.category === 'FLAG') {
      return question.imageUrl.replace(/(flagcdn\.com\/w\d+\/)([A-Z]{2})(\.png)$/i, (_match, prefix, code, suffix) => {
        return `${prefix}${String(code).toLowerCase()}${suffix}`;
      });
    }

    return question.imageUrl;
  }, [question.category, question.imageUrl]);

  const showQuestionImage =
    Boolean(normalizedImageUrl) &&
    !hasImageError &&
    (question.category === 'FLAG' || question.category === 'SILHOUETTE');

  const isCompactMediaMode = compact && showQuestionImage;

  const getImageContainerClassName = () => {
    if (question.category === 'FLAG') {
      return 'media-box media-box--compact relative w-full max-w-md';
    }

    return compact
      ? 'media-box media-box--compact media-box--silhouette'
      : 'media-box media-box--silhouette';
  };

  const getImageClassName = () => {
    if (question.category === 'FLAG') {
      return 'h-full w-full object-contain';
    }

    return compact
      ? 'h-full w-full max-w-sm object-contain filter invert'
      : 'h-full w-full max-w-sm object-contain filter invert';
  };

  const headingClassName = `${
    compact
      ? question.category === 'MAP'
        ? 'text-[1.05rem] sm:text-[1.3rem]'
        : question.category === 'CAPITAL'
          ? 'text-[1.35rem] sm:text-[1.6rem]'
          : 'text-[1.2rem] sm:text-[1.5rem]'
      : 'text-[1.8rem] sm:text-4xl'
  } font-bold text-white break-words ${question.category === 'MAP' ? 'leading-snug' : 'leading-tight'}`;

  return (
    <div
      aria-label={t('game.questionOf', { current: questionNumber, total: totalQuestions })}
      className={`question-card rounded-3xl border border-gray-700 bg-gray-800/95 shadow-xl shadow-black/25 overflow-hidden ${compact ? 'px-4 py-2.5 sm:px-5 sm:py-3' : 'px-4 py-5 sm:px-6 sm:py-6'} ${isCompactMediaMode ? 'question-card--with-media' : ''}`}
    >
      <div className="text-center">
        {showQuestionImage && (
          <div className={compact ? 'mb-1' : 'mb-6'}>
            <div className={`mx-auto flex items-center justify-center overflow-hidden rounded-xl border border-gray-600/70 bg-black/15 px-2 ${getImageContainerClassName()}`}>
              <img
                src={normalizedImageUrl}
                alt={t('game.questionImageAlt', { category: question.category.toLowerCase() })}
                loading="lazy"
                width={question.category === 'FLAG' ? 360 : 220}
                height={question.category === 'FLAG' ? 190 : 220}
                className={`mx-auto ${getImageClassName()}`}
                onError={() => setHasImageError(true)}
              />

              {question.category === 'FLAG' && question.difficulty && (
                <span
                  className={`absolute right-2 top-2 inline-block rounded-full px-2 py-0.5 text-[0.62rem] font-semibold sm:text-[0.68rem] ${getDifficultyClass()}`}
                >
                  {t(getDifficultyKey())}
                </span>
              )}
            </div>
          </div>
        )}

        <div className={`flex ${compact ? 'flex-row items-start justify-center gap-1.5 text-left' : 'flex-col items-center'} ${question.category === 'CAPITAL' ? 'w-full justify-center text-center' : ''}`}>
          <h2 className={headingClassName}>{getQuestionText()}</h2>

          {question.difficulty && question.category !== 'FLAG' && (
            <div className={compact ? 'mt-0.5 shrink-0' : 'mt-5'}>
              <span className={`inline-block rounded-full ${compact ? 'px-2.5 py-0.5 text-[0.65rem] sm:text-xs' : 'px-3.5 py-1 text-xs sm:text-sm'} font-semibold ${getDifficultyClass()}`}>
                {t(getDifficultyKey())}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
