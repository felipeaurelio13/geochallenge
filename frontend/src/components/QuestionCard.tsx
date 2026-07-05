import { useMemo } from 'react';
import { Question } from '../types';
import { useImageWithFallback } from '../hooks/useImageWithFallback';
import { useTranslation } from 'react-i18next';
import { parseCinemaGeoQuestionData } from '../data/cinemaGeo';
import { getLocalizedQuestionText } from '../utils/questionText';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  compact?: boolean;
  onImageError?: () => void;
  /**
   * true cuando el intento de reemplazar la pregunta (tras el fallo de imagen)
   * TAMBIÉN falló — a diferencia de `hasImageError` (estado local de la propia
   * imagen), esto lo controla el padre porque depende de un fetch async fuera
   * de este componente. Cuando es true mostramos Reintentar/Saltar en vez del
   * fallback silencioso.
   */
  replacementFailed?: boolean;
  onRetryImage?: () => void;
  onSkipQuestion?: () => void;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  compact = false,
  onImageError,
  replacementFailed = false,
  onRetryImage,
  onSkipQuestion,
}: QuestionCardProps) {
  const { t, i18n } = useTranslation();

  // Texto de la pregunta localizado. Antes esta lógica vivía aquí inline y
  // ramificaba a `question.questionText` (backend → siempre español) para
  // CINEMA_GEO, produciendo el bug ROUND2-001. Ahora vive en un util compartido
  // que tanto QuestionCard como DailyChallengePage usan.
  const getQuestionText = () => getLocalizedQuestionText(question, t, i18n.language);

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

  // CINEMA_GEO v2 never carries an image — the movie card is rendered client-side from
  // the embedded movie title/year. So showQuestionImage excludes it.
  const showQuestionImage =
    Boolean(normalizedImageUrl) &&
    !hasImageError &&
    (question.category === 'FLAG' || question.category === 'SILHOUETTE' || question.category === 'MONUMENT');

  const isCompactMediaMode = compact && showQuestionImage;

  const cinemaPayload = question.category === 'CINEMA_GEO' ? parseCinemaGeoQuestionData(question.questionData) : null;

  const getImageContainerClassName = () => {
    if (question.category === 'FLAG') {
      return 'media-box media-box--compact relative w-full max-w-md';
    }

    if (question.category === 'MONUMENT') {
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

    if (question.category === 'MONUMENT') {
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
                : question.category === 'MONUMENT'
                  ? 'border border-[var(--color-border)]/70 bg-black/40'
                  : 'border border-[var(--color-border)]/60 bg-black/15 px-2'
            } ${getImageContainerClassName()}`}>
              <img
                src={normalizedImageUrl}
                alt={t('game.questionImageAlt', { category: question.category.toLowerCase() })}
                loading="eager"
                width={question.category === 'FLAG' ? 360 : question.category === 'MONUMENT' ? 640 : 220}
                height={question.category === 'FLAG' ? 190 : question.category === 'MONUMENT' ? 360 : 220}
                className={`mx-auto ${getImageClassName()}`}
                onError={handleImageError}
              />

              {(question.category === 'FLAG' || question.category === 'MONUMENT') && question.difficulty && (
                <span
                  className={`absolute right-2 top-2 inline-block rounded-full px-2 py-0.5 text-[0.62rem] font-semibold sm:text-[0.68rem] ${getDifficultyClass()}`}
                >
                  {t(getDifficultyKey())}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Reemplazo de pregunta también falló: en vez del fallback silencioso,
            damos control real al usuario (Reintentar / Saltar) en lugar de
            dejarlo atascado con el timer corriendo sobre una pregunta vacía. */}
        {hasImageError && onImageError && replacementFailed && (
          <div className={compact ? 'mb-1' : 'mb-6'}>
            <div className="media-box media-box--compact mx-auto flex flex-col items-center justify-center gap-3 rounded-xl border border-app-border/70 bg-app-muted/50 px-3 py-3">
              <span className="text-4xl opacity-40">🖼️</span>
              <p className="text-xs text-app-subtle">{t('game.imageErrorTitle', 'No pudimos cargar esta imagen 🖼️')}</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {onRetryImage && (
                  <button
                    type="button"
                    onClick={onRetryImage}
                    className="rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-xs font-semibold text-app-text hover:bg-app-muted"
                  >
                    {t('game.imageErrorRetry', 'Reintentar')}
                  </button>
                )}
                {onSkipQuestion && (
                  <button
                    type="button"
                    onClick={onSkipQuestion}
                    className="rounded-lg border border-app-border bg-app-surface px-3 py-1.5 text-xs font-semibold text-app-text hover:bg-app-muted"
                  >
                    {t('game.imageErrorSkip', 'Saltar pregunta')}
                  </button>
                )}
              </div>
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

        {/* Cinema & Geography: compact context chip above the prompt. Frees ~300px of vertical
            space for the prompt + options. The answer is always a place, so showing the movie
            title is intentional context — not a spoiler. */}
        {question.category === 'CINEMA_GEO' && cinemaPayload && (
          <div className={`flex flex-wrap items-center justify-center gap-2 ${compact ? 'mb-2' : 'mb-4'}`}>
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-rose-400/60 bg-rose-100 px-3 py-1 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
              <span aria-hidden>🎬</span>
              {cinemaPayload.movieTitle && (
                <span className="truncate text-xs font-semibold sm:text-sm">{cinemaPayload.movieTitle}</span>
              )}
              {cinemaPayload.movieYear > 0 && (
                <span className="text-[0.65rem] text-rose-700/80 dark:text-rose-200/70 sm:text-xs">({cinemaPayload.movieYear})</span>
              )}
            </span>
            {question.difficulty && (
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[0.62rem] font-semibold sm:text-[0.68rem] ${getDifficultyClass()}`}>
                {t(getDifficultyKey())}
              </span>
            )}
          </div>
        )}

        <div className={`flex ${compact ? 'flex-row items-start justify-center gap-1.5 text-left' : 'flex-col items-center'} ${question.category === 'CAPITAL' ? 'w-full justify-center text-center' : ''}`}>
          <h2 className={headingClassName}>{getQuestionText()}</h2>

          {question.difficulty && question.category !== 'FLAG' && question.category !== 'MONUMENT' && question.category !== 'CINEMA_GEO' && (
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
