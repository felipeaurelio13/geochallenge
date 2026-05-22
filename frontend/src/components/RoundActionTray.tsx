import { ReactNode } from 'react';
import { AnswerStatusBadge } from './AnswerStatusBadge';

type RoundActionTrayProps = {
  mode?: 'single' | 'duel' | 'challenge';
  showResult: boolean;
  canSubmit: boolean;
  isWaiting?: boolean;
  isSubmitting?: boolean;
  /** When true, hides the confirm button (answer auto-submits on option click). */
  autoSubmit?: boolean;
  submitLabel: string;
  nextLabel?: string;
  waitingLabel?: string;
  resultLabel?: string;
  selectionAssistiveText?: string;
  onSubmit: () => void;
  onNext?: () => void;
  showResultBadge?: boolean;
  isCorrect?: boolean;
  resultHint?: string;
  /** Atribución opcional (e.g. crédito de imagen) mostrada solo en showResult. */
  resultAttribution?: ReactNode;
  summarySlot?: ReactNode;
};

const CONTAINER_CLASS =
  'w-full border-t border-[var(--color-border)]/70 bg-gradient-to-t from-[var(--color-bg-shell)]/95 via-[var(--color-surface)]/96 to-[var(--color-surface)]/70 px-3 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] pt-[clamp(0.45rem,1.2dvh,0.65rem)] backdrop-blur sm:px-4';

export function RoundActionTray({
  mode = 'single',
  showResult,
  canSubmit,
  isWaiting = false,
  isSubmitting = false,
  autoSubmit = false,
  submitLabel,
  nextLabel,
  waitingLabel,
  resultLabel,
  selectionAssistiveText,
  onSubmit,
  onNext,
  showResultBadge = false,
  isCorrect = false,
  resultHint,
  resultAttribution,
  summarySlot,
}: RoundActionTrayProps) {
  const wrapperClassName =
    mode === 'challenge'
      ? 'mx-auto flex w-full max-w-4xl flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between'
      : 'mx-auto flex w-full max-w-4xl flex-col gap-1 rounded-2xl border border-[var(--color-border)]/50 bg-[var(--color-surface-muted)]/85 p-[clamp(0.35rem,1.1dvh,0.5rem)] shadow-lg sm:flex-row sm:items-center sm:justify-between';

  return (
    <div className={CONTAINER_CLASS} data-testid="mobile-action-tray">
      <div className={wrapperClassName}>
        {summarySlot}

        {!showResult && !isWaiting && !autoSubmit && (
          <div className="flex flex-1 flex-col justify-center gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="w-full sm:w-auto rounded-2xl border border-primary/50 bg-primary px-6 py-1.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all duration-150 hover:bg-primary/90 hover:shadow-primary/30 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:bg-[var(--color-surface-muted)] disabled:text-[var(--color-text-muted)] disabled:shadow-none disabled:opacity-70 sm:text-base"
            >
              {submitLabel}
            </button>

            {selectionAssistiveText && canSubmit && (
              <p className="w-full text-center text-xs text-cyan-100/85 sm:text-right">{selectionAssistiveText}</p>
            )}
          </div>
        )}

        {isWaiting && (
          <div className="w-full rounded-2xl border border-gray-700 bg-gray-800/95 p-2 text-center backdrop-blur-sm shadow-sm shadow-black/30">
            <p className="text-sm text-gray-200">{waitingLabel}</p>
          </div>
        )}

        {showResult && (
          <div className="w-full flex flex-col items-center gap-1.5">
            {showResultBadge && resultLabel && (
              <AnswerStatusBadge
                status={isCorrect ? 'correct' : 'incorrect'}
                label={resultLabel}
                className="text-sm"
              />
            )}

            {resultHint && <p className="text-center text-xs leading-snug text-gray-300">{resultHint}</p>}

            {resultAttribution && (
              <div className="text-center text-[0.65rem] leading-snug text-gray-400/80 sm:text-xs">
                {resultAttribution}
              </div>
            )}

            {nextLabel && onNext && (
              <button
                type="button"
                onClick={onNext}
                disabled={isSubmitting}
                className="w-full rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-surface)] px-6 py-2 text-sm sm:text-base font-semibold text-[var(--color-text-primary)] shadow-sm hover:bg-[var(--color-surface-muted)] active:scale-[0.99] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-wait disabled:opacity-70"
              >
                {nextLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
