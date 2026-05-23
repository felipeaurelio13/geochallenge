import { useMemo } from 'react';
import { Question } from '../types';
import { useImageWithFallback } from '../hooks/useImageWithFallback';
import { useTranslation } from 'react-i18next';
import { parseMonumentQuestionData } from '../data/monuments';
import { parseMovieSceneQuestionData, getLocalizedMovieName, resolveSceneLanguage } from '../data/movieScenes';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  compact?: boolean;
  onImageError?: () => void;
}

export function QuestionCard({ question, questionNumber, totalQuestions, compact = false, onImageError }: QuestionCardProps) {
  const { t, i18n } = useTranslation();

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
      case 'MONUMENT': {
        const variant = parseMonumentQuestionData(question.questionData)?.variant ?? 'identify';
        return variant === 'country'
          ? t('game.questionMonumentCountry')
          : t('game.questionMonumentIdentify');
      }
      case 'MOVIE_SCENE': {
        const payload = parseMovieSceneQuestionData(question.questionData);
        const lang = resolveSceneLanguage(i18n.language);
        const movieName = payload ? (getLocalizedMovieName(payload.slug, lang) ?? '') : '';
        const variant = payload?.variant ?? 'country';
        if (movieName) {
          return variant === 'city'
            ? t('game.questionMovieSceneCity', { movie: movieName })
            : t('game.questionMovieSceneCountry', { movie: movieName });
        }
        // Fallback: backend already includes the movie name in questionText
        if (question.questionText?.trim()) return question.questionText;
        return variant === 'city'
          ? t('game.questionMovieSceneCity', { movie: '' })
          : t('game.questionMovieSceneCountry', { movie: '' });
      }
      default:
        return getFallbackQuestionText();
    }
  };

  const getDifficultyClass = () => {
    const difficulty = question.difficulty?.toUpperCase() || 'MEDIUM';
    switch (difficulty) {
      case 'EASY':
        return 'border border-green-500/30 bg-green-500/15 text-[var(--color-success-600)]';
      case 'HARD':
        return 'border border-red-500/30 bg-red-500/15 text-[var(--color-error-500)]';
      default:
        return 'border border-amber-500/30 bg-amber-500/15 text-amber-600';
    }
  };

  const getDifficultyKey = () => {
    const difficulty = question.difficulty?.toLowerCase() || 'medium';
    return `game.difficulty.${difficulty}`;
  };

  const primaryImageUrl = useMemo(() => {
    if (!question.imageUrl) return undefined;

    if (question.category === 'FLAG') {
      return question.imageUrl.replace(/(flagcdn\.com\/w\d+\/)([A-Z]{2})(\.png)$/i, (_match, prefix, code, suffix) => {
        return `${prefix}${String(code).toLowerCase()}${suffix}`;
      });
    }

    if (question.category === 'SILHOUETTE') {
      return question.imageUrl.replace(
        'https://raw.githubusercontent.com/djaiss/mapsicon/master/all/',
        'https://cdn.jsdelivr.net/gh/djaiss/mapsicon@master/all/'
      );
    }

    return question.imageUrl;
  }, [question.category, question.imageUrl]);

  const { src: normalizedImageUrl, hasError: hasImageError, handleError: handleImageError } = useImageWithFallback(primaryImageUrl, onImageError);

  const showQuestionImage =
    Boolean(normalizedImageUrl) &&
    !hasImageError &&
    (question.category === 'FLAG' || question.category === 'SILHOUETTE' || question.category === 'MONUMENT' || question.category === 'MOVIE_SCENE');

  const isCompactMediaMode = compact && showQuestionImage;

  const getImageContainerClassName = () => {
    if (question.category === 'FLAG') {
      return 'media-box media-box--compact relative w-full max-w-md';
    }

    if (question.category === 'MONUMENT' || question.category === 'MOVIE_SCENE') {
      return compact
        ? 'media-box media-box--compact relative w-full max-w-xl aspect-[16/9] overflow-hidden'
        : 'media-box relative w-full max-w-xl aspect-[16/9] overflow-hidden';
    }

    return compact
      ? 'media-box media-box--compact media-box--silhouette'
      : 'media-box media-box--silhouette';
  };

  const getImageClassName = () => {
    if (question.category === 'FLAG') {
      return 'h-full w-full object-contain object-center';
    }

    if (question.category === 'MONUMENT' || question.category === 'MOVIE_SCENE') {
      return 'h-full w-full object-cover object-center';
    }

    return 'h-full w-full object-contain object-center filter invert drop-shadow-[0_0_14px_rgba(148,163,184,0.45)]';
  };

  const headingClassName = `${
    compact
      ? question.category === 'MAP'
        ? 'text-[clamp(1rem,3.8vw,1.22rem)] sm:text-[1.3rem]'
        : question.category === 'CAPITAL'
          ? 'text-[clamp(1.1rem,4.2vw,1.4rem)] sm:text-[1.6rem]'
          : 'text-[clamp(1.05rem,4vw,1.28rem)] sm:text-[1.5rem]'
      : 'text-[clamp(1.2rem,4.5vw,1.8rem)] sm:text-4xl'
  } font-bold text-app-text break-words ${question.category === 'MAP' ? 'leading-snug' : 'leading-tight'}`;

  return (
    <div
      aria-label={t('game.questionOf', { current: questionNumber, total: totalQuestions })}
      className={`question-card rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]/95 shadow-xl shadow-black/25 ${compact ? 'px-4 py-2 sm:px-5 sm:py-3' : 'px-4 py-4 sm:px-6 sm:py-6'} ${isCompactMediaMode ? 'question-card--with-media' : ''}`}
    >
      <div className="text-center">
        {showQuestionImage && (
          <div className={compact ? 'mb-1' : 'mb-6'}>
            <div className={`mx-auto flex items-center justify-center rounded-xl ${
              question.category === 'SILHOUETTE'
                ? 'border border-[var(--color-border)]/60 bg-[var(--color-bg-shell)]/90 p-3'
                : question.category === 'MONUMENT' || question.category === 'MOVIE_SCENE'
                  ? 'border border-[var(--color-border)]/70 bg-black/40'
                  : 'border border-[var(--color-border)]/60 bg-black/15 px-2'
            } ${getImageContainerClassName()}`}>
              <img
                src={normalizedImageUrl}
                alt={t('game.questionImageAlt', { category: question.category.toLowerCase() })}
                loading="eager"
                width={question.category === 'FLAG' ? 360 : (question.category === 'MONUMENT' || question.category === 'MOVIE_SCENE') ? 640 : 220}
                height={question.category === 'FLAG' ? 190 : (question.category === 'MONUMENT' || question.category === 'MOVIE_SCENE') ? 360 : 220}
                className={`mx-auto ${getImageClassName()}`}
                onError={handleImageError}
              />

              {(question.category === 'FLAG' || question.category === 'MONUMENT' || question.category === 'MOVIE_SCENE') && question.difficulty && (
                <span
                  className={`absolute right-2 top-2 inline-block rounded-full px-2 py-0.5 text-[0.62rem] font-semibold sm:text-[0.68rem] ${getDifficultyClass()}`}
                >
                  {t(getDifficultyKey())}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error fallback shown only when no replacement handler is wired (e.g. offline/challenge mode) */}
        {hasImageError && !onImageError && question.category === 'FLAG' && (
          <div className={compact ? 'mb-1' : 'mb-6'}>
            <div className="media-box media-box--compact mx-auto flex flex-col items-center justify-center gap-2 rounded-xl border border-app-border/70 bg-app-muted/50 px-2">
              <span className="text-4xl opacity-30">🏳️</span>
              <p className="text-xs text-app-subtle">{t('game.flagUnavailable', 'Bandera no disponible')}</p>
            </div>
          </div>
        )}

        {hasImageError && !onImageError && question.category === 'SILHOUETTE' && (
          <div className={compact ? 'mb-1' : 'mb-6'}>
            <div className="media-box media-box--silhouette mx-auto flex flex-col items-center justify-center gap-2 rounded-xl border border-app-border/60 bg-app-surface/90 p-3">
              <span className="text-4xl opacity-30">🌐</span>
              <p className="text-xs text-slate-500">{t('game.silhouetteUnavailable', 'Silueta no disponible')}</p>
            </div>
          </div>
        )}

        {hasImageError && !onImageError && question.category === 'MONUMENT' && (
          <div className={compact ? 'mb-1' : 'mb-6'}>
            <div className="mx-auto flex aspect-[16/9] w-full max-w-xl flex-col items-center justify-center gap-2 rounded-xl border border-app-border/70 bg-black/40 p-4">
              <span className="text-5xl opacity-40">🗿</span>
              <p className="text-xs text-app-subtle">{t('game.monumentUnavailable', 'Imagen no disponible')}</p>
            </div>
          </div>
        )}

        {hasImageError && !onImageError && question.category === 'MOVIE_SCENE' && (
          <div className={compact ? 'mb-1' : 'mb-6'}>
            <div className="mx-auto flex aspect-[16/9] w-full max-w-xl flex-col items-center justify-center gap-2 rounded-xl border border-app-border/70 bg-black/40 p-4">
              <span className="text-5xl opacity-40">🎬</span>
              <p className="text-xs text-app-subtle">{t('game.movieSceneUnavailable', 'Imagen no disponible')}</p>
            </div>
          </div>
        )}

        <div className={`flex ${compact ? 'flex-row items-start justify-center gap-1.5 text-left' : 'flex-col items-center'} ${question.category === 'CAPITAL' ? 'w-full justify-center text-center' : ''}`}>
          <h2 className={headingClassName}>{getQuestionText()}</h2>

          {question.difficulty && question.category !== 'FLAG' && question.category !== 'MONUMENT' && question.category !== 'MOVIE_SCENE' && (
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
