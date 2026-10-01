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
  /**
   * El servidor aún no revela la respuesta correcta (p.ej. desafíos puntuados al
   * final). Con showResult activo, la opción elegida se muestra como "respuesta
   * enviada" en estilo neutro en vez de marcarse como incorrecta.
   */
  lockedResult?: boolean;
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
  lockedResult = false,
}: OptionButtonProps) {
  const { t } = useTranslation();
  const renderedLabel = displayLabel ?? option;
  const isSubmittedUnrevealed = showResult && lockedResult && !isCorrect && selected;
  // focus-visible: only show focus ring on KEYBOARD navigation, not on touch/click.
  // Antes el browser dejaba un focus ring azul sobre la última opción tras click
  // o navegación — los QA rounds 1-3 lo reportaron como "parece pre-seleccionado".
  // Conservamos a11y para teclado (Tab) pero quitamos el ruido visual del click.
  const baseClasses =
    'option-button-shell pressable w-full min-h-12 rounded-md text-left transition-[border-color,background-color,opacity,transform] duration-150 flex items-center gap-2.5 overflow-hidden border px-3 py-2 option-button-base sm:px-3.5 sm:py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-bg-app)]';

  const defaultStateClasses =
    'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-primary-400)] hover:bg-[var(--color-surface-muted)] cursor-pointer';
  // Tailwind no genera modificadores de opacidad (`/10`) para colores definidos
  // como var(--token): se usan color-mix arbitrarios para el tinte y el ring.
  const selectedStateClasses =
    'bg-[color-mix(in_srgb,var(--color-primary-500)_10%,transparent)] border-primary text-[var(--color-text-primary)] ring-1 ring-[color:color-mix(in_srgb,var(--color-primary-500)_25%,transparent)]';
  const disabledStateClasses =
    'bg-[var(--color-surface-muted)] border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed';
  const lockedStateClasses =
    'bg-[var(--color-surface-muted)] border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-not-allowed opacity-60';
  const submittedStateClasses =
    'bg-[color-mix(in_srgb,var(--color-primary-500)_10%,transparent)] border-primary text-[var(--color-text-primary)] ring-1 ring-[color:color-mix(in_srgb,var(--color-primary-500)_25%,transparent)] cursor-not-allowed';
  const eliminatedStateClasses =
    'bg-[var(--color-surface-muted)] border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed opacity-50';
  const correctStateClasses =
    'bg-[color-mix(in_srgb,var(--color-success-500)_10%,transparent)] border-success-500 text-[var(--color-text-primary)] cursor-not-allowed';
  const wrongStateClasses =
    'bg-[color-mix(in_srgb,var(--color-error-500)_10%,transparent)] border-error-500 text-[var(--color-text-primary)] cursor-not-allowed';

  const getButtonClasses = () => {
    if (showResult) {
      if (isSubmittedUnrevealed) return `${baseClasses} ${submittedStateClasses}`;
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
          ? (isCorrect ? 'correct' : isSubmittedUnrevealed ? 'submitted' : selected ? 'wrong' : 'locked')
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
            ? 'bg-success-soft text-success'
            : isSubmittedUnrevealed
              ? 'bg-primary text-app-on-accent'
            : showResult && selected && !isCorrect
              ? 'bg-error-soft text-error'
            : eliminated
              ? 'bg-[var(--color-border)] text-[var(--color-text-muted)]'
            : selected
                ? 'bg-primary text-app-on-accent'
                : 'bg-[var(--color-border)] text-[var(--color-text-secondary)]'
        }`}
      >
        {showResult && isCorrect ? '✓' : isSubmittedUnrevealed ? optionLetters[index] : showResult && selected && !isCorrect ? '✕' : eliminated ? '—' : optionLetters[index]}
        {showResult && isCorrect && <span className="sr-only">{t('a11y.correctAnswer')}</span>}
        {isSubmittedUnrevealed && <span className="sr-only">{t('a11y.answerLocked')}</span>}
        {showResult && selected && !isCorrect && !isSubmittedUnrevealed && <span className="sr-only">{t('a11y.incorrectAnswer')}</span>}
        {!showResult && eliminated && <span className="sr-only">{t('a11y.eliminatedOption')}</span>}
      </span>

      <div className="flex min-w-0 flex-1 items-center">
        <span className={`option-button-label min-w-0 flex-1 text-[0.82rem] font-medium leading-[1.2] sm:text-[0.92rem] md:text-[1rem] ${eliminated ? 'line-through opacity-60' : ''}`}>
          {renderedLabel}
        </span>
      </div>

      <span className="flex w-[4.75rem] shrink-0 items-center justify-end text-right text-[0.68rem] font-semibold leading-tight" aria-live="polite">
        {showResult && isCorrect ? (
          <span className="text-success">{t('game.correctLabel')}</span>
        ) : isSubmittedUnrevealed ? (
          <span className="text-primary">{t('game.yourAnswer')}</span>
        ) : showResult && selected ? (
          <span className="text-error">{t('game.yourAnswer')}</span>
        ) : null}
      </span>
    </button>
  );
});
