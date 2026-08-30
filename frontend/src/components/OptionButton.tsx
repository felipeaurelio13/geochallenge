import React from 'react';
import { useTranslation } from 'react-i18next';
import { triggerHaptic } from '../hooks/useHaptics';

interface OptionButtonProps {
  option: string;
  /**
   * Etiqueta a mostrar (puede diferir de `option` cuando se localiza el display).
   * El valor crudo en `option` se sigue usando para el callback y la comparación
   * con la respuesta correcta — esta prop no rompe el contrato de selección.
   */
  displayLabel?: string;
  index: number;
  onClick: () => void;
  disabled: boolean;
  eliminated?: boolean;
  selected: boolean;
  isCorrect?: boolean;
  showResult: boolean;
}

const optionLetters = ['A', 'B', 'C', 'D'];

export const OptionButton = React.memo(function OptionButton({
  option,
  displayLabel,
  index,
  onClick,
  disabled,
  eliminated = false,
  selected,
  isCorrect,
  showResult,
}: OptionButtonProps) {
  const { t } = useTranslation();
  const renderedLabel = displayLabel ?? option;
  // focus-visible: only show focus ring on KEYBOARD navigation, not on touch/click.
  // Antes el browser dejaba un focus ring azul sobre la última opción tras click
  // o navegación — los QA rounds 1-3 lo reportaron como "parece pre-seleccionado".
  // Conservamos a11y para teclado (Tab) pero quitamos el ruido visual del click.
  const baseClasses =
    'option-button-shell pressable w-full min-h-12 rounded-md text-left transition-[border-color,background-color,opacity,transform] duration-150 flex items-center gap-2.5 overflow-hidden border px-3 py-2 option-button-base sm:px-3.5 sm:py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-bg-app)]';

  const defaultStateClasses =
    'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-primary-400)] hover:bg-[var(--color-surface-muted)] cursor-pointer';
  const selectedStateClasses =
    'bg-primary/10 border-primary text-[var(--color-text-primary)] ring-1 ring-primary/25';
  const disabledStateClasses =
    'bg-[var(--color-surface-muted)] border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed';
  const lockedStateClasses =
    'bg-[var(--color-surface-muted)] border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-not-allowed opacity-60';
  const eliminatedStateClasses =
    'bg-[var(--color-surface-muted)] border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed opacity-50';
  const correctStateClasses =
    'bg-success-500/10 border-success-500 text-[var(--color-text-primary)] cursor-not-allowed';
  const wrongStateClasses =
    'bg-error-500/10 border-error-500 text-[var(--color-text-primary)] cursor-not-allowed';

  const getButtonClasses = () => {
    if (showResult) {
      if (isCorrect) return `${baseClasses} ${correctStateClasses}`;
      if (selected && !isCorrect) return `${baseClasses} ${wrongStateClasses}`;
      return `${baseClasses} ${lockedStateClasses}`;
    }

    if (eliminated) return `${baseClasses} ${eliminatedStateClasses}`;
    if (selected) return `${baseClasses} ${selectedStateClasses}`;
    if (disabled) return `${baseClasses} ${disabledStateClasses}`;
    return `${baseClasses} ${defaultStateClasses}`;
  };

  const handleClick = () => {
    if (!disabled && !showResult) {
      triggerHaptic('tap');
    }
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={getButtonClasses()}
      aria-pressed={selected}
      data-state={
        showResult
          ? (isCorrect ? 'correct' : selected ? 'wrong' : 'locked')
          : eliminated
            ? 'eliminated'
            : selected
              ? 'selected'
              : disabled
                ? 'disabled'
                : 'default'
      }
    >
      <span
        className={`option-button-index flex h-7 w-7 shrink-0 rounded-full items-center justify-center self-center font-bold text-xs transition-colors sm:text-sm ${
          showResult && isCorrect
            ? 'bg-success-500/15 text-success-600 dark:text-success-500'
            : showResult && selected && !isCorrect
              ? 'bg-error-500/15 text-error-600 dark:text-error-500'
            : eliminated
              ? 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
            : selected
                ? 'bg-primary/80 text-white'
                : 'bg-[var(--color-border)] text-[var(--color-text-secondary)]'
        }`}
      >
        {showResult && isCorrect ? '✓' : showResult && selected && !isCorrect ? '✕' : eliminated ? '—' : optionLetters[index]}
        {showResult && isCorrect && <span className="sr-only">{t('a11y.correctAnswer')}</span>}
        {showResult && selected && !isCorrect && <span className="sr-only">{t('a11y.incorrectAnswer')}</span>}
        {!showResult && eliminated && <span className="sr-only">{t('a11y.eliminatedOption')}</span>}
      </span>

      <div className="flex min-w-0 flex-1 items-center">
        <span className={`option-button-label min-w-0 flex-1 text-[0.82rem] font-medium leading-[1.2] sm:text-[0.92rem] md:text-[1rem] ${eliminated ? 'line-through opacity-60' : ''}`}>
          {renderedLabel}
        </span>
      </div>

      <span className="flex w-[4.75rem] shrink-0 items-center justify-end text-right text-[0.68rem] font-semibold leading-tight" aria-live="polite">
        {showResult && isCorrect ? (
          <span className="text-success-600 dark:text-success-500">{t('game.correctLabel')}</span>
        ) : showResult && selected ? (
          <span className="text-error-600 dark:text-error-500">{t('game.yourAnswer')}</span>
        ) : null}
      </span>
    </button>
  );
});
