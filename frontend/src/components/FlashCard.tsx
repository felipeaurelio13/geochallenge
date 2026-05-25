import { useMemo } from 'react';
import { Question } from '../types';
import { useGesture } from '../hooks/useGesture';
import { triggerHaptic } from '../hooks/useHaptics';
import { useImageWithFallback } from '../hooks/useImageWithFallback';
import { useTranslation } from 'react-i18next';
import { getOptionDisplayLabel } from '../utils/monumentOptions';
import { parseCinemaGeoQuestionData } from '../data/cinemaGeo';

interface FlashCardProps {
  question: Question;
  onAnswer: (option: string) => void;
  disabled?: boolean;
  disabledOptions?: string[];
  feedback?: 'correct' | 'incorrect' | null;
  onImageError?: () => void;
}

const VISUAL_ALT: Record<string, string> = {
  FLAG: 'Bandera',
  SILHOUETTE: 'Silueta',
  MONUMENT: 'Monumento',
  CINEMA_GEO: 'Pregunta de Cine & Geografía',
};

export function FlashCard({ question, onAnswer, disabled, disabledOptions = [], feedback, onImageError }: FlashCardProps) {
  const { t, i18n } = useTranslation();
  const [optionA, optionB] = useMemo(() => {
    const opts = question.options.slice(0, 2);
    return [opts[0] ?? '', opts[1] ?? ''];
  }, [question]);

  const displayA = getOptionDisplayLabel(question, optionA, i18n.language);
  const displayB = getOptionDisplayLabel(question, optionB, i18n.language);

  const rawImageUrl =
    question.imageUrl ||
    (typeof question.questionData === 'object' && question.questionData
      ? (question.questionData.flagUrl ?? question.questionData.silhouetteUrl)
      : undefined);

  const { src: imageUrl, hasError: hasImageError, handleError: handleImageError } = useImageWithFallback(rawImageUrl, onImageError);

  const handleAnswer = (option: string) => {
    if (disabled || !option) return;
    triggerHaptic('tap');
    onAnswer(option);
  };

  const swipeHandlers = useGesture({
    onSwipeLeft: () => handleAnswer(optionA),
    onSwipeRight: () => handleAnswer(optionB),
    threshold: 40,
  });

  const feedbackClass =
    feedback === 'correct'
      ? 'border-green-400 ring-4 ring-green-400/40 bg-green-950/30'
      : feedback === 'incorrect'
        ? 'border-red-400 ring-4 ring-red-400/40 bg-red-950/30'
        : 'border-[var(--color-border)]';

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div
        {...swipeHandlers}
        className={`relative flex-1 min-h-0 overflow-hidden rounded-3xl border-2 bg-[var(--color-surface)] shadow-xl transition-all duration-150 ${feedbackClass}`}
        role="img"
        aria-label={`${VISUAL_ALT[question.category] ?? 'Imagen'} a identificar`}
      >
        {imageUrl && !hasImageError ? (
          <img
            src={imageUrl}
            alt={`${VISUAL_ALT[question.category] ?? 'Imagen'}`}
            className={`absolute inset-0 h-full w-full ${
              question.category === 'MONUMENT' ? 'object-cover' : 'object-contain p-6'
            }${question.category === 'SILHOUETTE' ? ' filter invert drop-shadow-[0_0_14px_rgba(148,163,184,0.45)]' : ''}`}
            draggable={false}
            onError={handleImageError}
          />
        ) : question.category === 'CINEMA_GEO' ? (() => {
          const cgPayload = parseCinemaGeoQuestionData(question.questionData);
          const kindHint = cgPayload?.answerKind === 'country'
            ? t('flash.cinemaWhereCountry', '¿En qué país se filmó?')
            : cgPayload?.answerKind === 'city'
              ? t('flash.cinemaWhereCity', '¿En qué ciudad se filmó?')
              : t('flash.cinemaWhereVenue', '¿Dónde se filmó?');
          return (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-rose-950/60 to-gray-900/80 px-4 text-center">
              <span className="text-4xl">🎬</span>
              {cgPayload?.movieTitle && (
                <p className="text-base font-bold text-rose-200 sm:text-lg">{cgPayload.movieTitle}</p>
              )}
              <p className="text-sm font-medium text-rose-100/90">{kindHint}</p>
            </div>
          );
        })() : (
          <div className="flex h-full items-center justify-center text-6xl">{question.category === 'MONUMENT' ? '🗿' : '🌍'}</div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-center text-xs text-gray-200">
          {t('flash.swipeHint')}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleAnswer(optionA)}
          disabled={disabled || disabledOptions.includes(optionA)}
          className="pressable min-h-16 rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-4 text-base font-semibold text-[var(--color-text-primary)] shadow-md transition-colors hover:border-primary/50 hover:bg-[var(--color-surface)] active:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Opción A: ${displayA}`}
        >
          <span className="mr-2 text-xs text-[var(--color-text-muted)]">←</span>
          {displayA}
        </button>
        <button
          type="button"
          onClick={() => handleAnswer(optionB)}
          disabled={disabled || disabledOptions.includes(optionB)}
          className="pressable min-h-16 rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-4 text-base font-semibold text-[var(--color-text-primary)] shadow-md transition-colors hover:border-primary/50 hover:bg-[var(--color-surface)] active:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Opción B: ${displayB}`}
        >
          {displayB}
          <span className="ml-2 text-xs text-[var(--color-text-muted)]">→</span>
        </button>
      </div>
    </div>
  );
}
