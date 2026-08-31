import { useMemo } from 'react';
import { Question } from '../types';
import { useGesture } from '../hooks/useGesture';
import { triggerHaptic } from '../hooks/useHaptics';
import { useImageWithFallback } from '../hooks/useImageWithFallback';
import { useTranslation } from 'react-i18next';
import { getOptionDisplayLabel } from '../utils/monumentOptions';
import { GeoMark } from './atoms/GeoMark';

interface FlashCardProps {
  question: Question;
  onAnswer: (option: string) => void;
  disabled?: boolean;
  disabledOptions?: string[];
  feedback?: 'correct' | 'incorrect' | null;
  onImageError?: () => void;
}

// Mapeo de categoría → clave i18n para el alt text del media. Antes era texto
// español hardcodeado (QA round 2 ROUND2-002): screen readers en inglés
// anunciaban "Bandera a identificar" dentro de UI en inglés.
const ALT_KEY: Record<string, { key: string; fallback: string }> = {
  FLAG: { key: 'flash.altFlag', fallback: 'Bandera' },
  SILHOUETTE: { key: 'flash.altSilhouette', fallback: 'Silueta' },
  MONUMENT: { key: 'flash.altMonument', fallback: 'Monumento' },
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
      ? 'border-success-500 bg-success-500/10'
      : feedback === 'incorrect'
        ? 'border-error-500 bg-error-500/10'
        : 'border-[var(--color-border)]';

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div
        {...swipeHandlers}
        className={`relative flex-1 min-h-0 overflow-hidden rounded-lg border bg-[var(--color-surface)] transition-[border-color,background-color] duration-150 ${feedbackClass}`}
        role="img"
        aria-label={t(
          'flash.altIdentify',
          { kind: t(ALT_KEY[question.category]?.key ?? 'flash.altImage', ALT_KEY[question.category]?.fallback ?? 'Imagen'), defaultValue: '{{kind}} a identificar' }
        )}
      >
        {imageUrl && !hasImageError ? (
          <img
            src={imageUrl}
            alt={t(ALT_KEY[question.category]?.key ?? 'flash.altImage', ALT_KEY[question.category]?.fallback ?? 'Imagen')}
            className={`absolute inset-0 h-full w-full ${
              question.category === 'MONUMENT' ? 'object-cover' : 'object-contain p-6'
            }${question.category === 'SILHOUETTE' ? ' filter invert drop-shadow-[0_0_14px_rgba(148,163,184,0.45)]' : ''}`}
            draggable={false}
            onError={handleImageError}
          />
        ) : (
          <div className="flex h-full items-center justify-center"><GeoMark className="h-16 w-16 text-app-subtle opacity-40" /></div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 p-3 text-center text-xs text-white">
          {t('flash.swipeHint')}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleAnswer(optionA)}
          disabled={disabled || disabledOptions.includes(optionA)}
          className="pressable min-h-16 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-4 text-base font-semibold text-[var(--color-text-primary)] transition-colors hover:border-primary/50 hover:bg-[var(--color-surface)] active:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Opción A: ${displayA}`}
        >
          <span className="mr-2 text-xs text-[var(--color-text-muted)]">←</span>
          {displayA}
        </button>
        <button
          type="button"
          onClick={() => handleAnswer(optionB)}
          disabled={disabled || disabledOptions.includes(optionB)}
          className="pressable min-h-16 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-4 text-base font-semibold text-[var(--color-text-primary)] transition-colors hover:border-primary/50 hover:bg-[var(--color-surface)] active:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Opción B: ${displayB}`}
        >
          {displayB}
          <span className="ml-2 text-xs text-[var(--color-text-muted)]">→</span>
        </button>
      </div>
    </div>
  );
}
