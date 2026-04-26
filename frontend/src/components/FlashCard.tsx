import { useMemo } from 'react';
import { Question } from '../types';
import { useGesture } from '../hooks/useGesture';
import { triggerHaptic } from '../hooks/useHaptics';
import { useTranslation } from 'react-i18next';

interface FlashCardProps {
  question: Question;
  onAnswer: (option: string) => void;
  disabled?: boolean;
  disabledOptions?: string[];
  feedback?: 'correct' | 'incorrect' | null;
}

const VISUAL_ALT: Record<string, string> = {
  FLAG: 'Bandera',
  SILHOUETTE: 'Silueta',
};

export function FlashCard({ question, onAnswer, disabled, disabledOptions = [], feedback }: FlashCardProps) {
  const { t } = useTranslation();
  const [optionA, optionB] = useMemo(() => {
    const opts = question.options.slice(0, 2);
    return [opts[0] ?? '', opts[1] ?? ''];
  }, [question]);

  const imageUrl =
    question.imageUrl ||
    (typeof question.questionData === 'object' && question.questionData
      ? (question.questionData.flagUrl ?? question.questionData.silhouetteUrl)
      : undefined);

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
      ? 'border-green-400 ring-4 ring-green-400/40'
      : feedback === 'incorrect'
        ? 'border-red-400 ring-4 ring-red-400/40'
        : 'border-gray-700';

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div
        {...swipeHandlers}
        className={`relative flex-1 min-h-0 overflow-hidden rounded-3xl border-2 bg-gray-900 shadow-xl transition-all ${feedbackClass}`}
        role="img"
        aria-label={`${VISUAL_ALT[question.category] ?? 'Imagen'} a identificar`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${VISUAL_ALT[question.category] ?? 'Imagen'}`}
            className={`absolute inset-0 h-full w-full object-contain p-6${question.category === 'SILHOUETTE' ? ' filter invert drop-shadow-[0_0_14px_rgba(148,163,184,0.45)]' : ''}`}
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl">🌍</div>
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
          className="pressable min-h-16 rounded-2xl border-2 border-gray-700 bg-gray-800 px-3 py-4 text-base font-semibold text-white shadow-md active:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Opción A: ${optionA}`}
        >
          <span className="mr-2 text-xs text-gray-400">←</span>
          {optionA}
        </button>
        <button
          type="button"
          onClick={() => handleAnswer(optionB)}
          disabled={disabled || disabledOptions.includes(optionB)}
          className="pressable min-h-16 rounded-2xl border-2 border-gray-700 bg-gray-800 px-3 py-4 text-base font-semibold text-white shadow-md active:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`Opción B: ${optionB}`}
        >
          {optionB}
          <span className="ml-2 text-xs text-gray-400">→</span>
        </button>
      </div>
    </div>
  );
}
