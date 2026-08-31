import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AnswerStatusBadge } from './AnswerStatusBadge';
import { Button } from './atoms/Button';

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
  correctAnswer?: string;
  resultHint?: string;
  /** Atribución opcional (e.g. crédito de imagen) mostrada solo en showResult. */
  resultAttribution?: ReactNode;
  summarySlot?: ReactNode;
  /** Single/Mixed piloto: una única acción con geometría constante. */
  stableAction?: boolean;
  validatingLabel?: string;
};

const CONTAINER_CLASS =
  'w-full border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] pt-[clamp(0.45rem,1.2dvh,0.65rem)] sm:px-4';

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
  correctAnswer,
  resultHint,
  resultAttribution,
  summarySlot,
  stableAction = false,
  validatingLabel,
}: RoundActionTrayProps) {
  const { t } = useTranslation();
  void mode;
  const wrapperClassName =
    'mx-auto flex w-full max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between';

  if (stableAction) {
    const actionLabel = isSubmitting
      ? validatingLabel ?? waitingLabel ?? submitLabel
      : showResult
        ? nextLabel ?? submitLabel
        : submitLabel;
    const handleAction = showResult ? onNext : onSubmit;

    return (
      <div className={CONTAINER_CLASS} data-testid="mobile-action-tray">
        <div className="mx-auto w-full max-w-4xl">
          <Button
            onClick={handleAction}
            disabled={isSubmitting || (!showResult && !canSubmit)}
            fullWidth
            size="lg"
            aria-live="polite"
          >
            {actionLabel}
          </Button>
          {selectionAssistiveText && canSubmit && !showResult && !isSubmitting && (
            <p className="sr-only" aria-live="polite">{selectionAssistiveText}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${CONTAINER_CLASS} ${showResult ? 'max-h-[45dvh] overflow-y-auto' : ''}`} data-testid="mobile-action-tray">
      <div className={wrapperClassName}>
        {summarySlot}

        {!showResult && !isWaiting && !autoSubmit && (
          <div className="flex flex-1 flex-col justify-center gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <Button
              onClick={onSubmit}
              disabled={!canSubmit}
              className="w-full py-1.5 disabled:opacity-70 sm:w-auto"
            >
              {submitLabel}
            </Button>

            {selectionAssistiveText && canSubmit && (
              <p className="sr-only" aria-live="polite">{selectionAssistiveText}</p>
            )}
          </div>
        )}

        {isWaiting && (
          <div className="w-full rounded-md border border-app-border bg-app-surface p-2 text-center">
            <p className="text-sm text-app-secondary">{waitingLabel}</p>
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

            {!isCorrect && correctAnswer && (
              <div className="flex items-start gap-2 w-full rounded-md border border-success/30 bg-success-soft px-3 py-2 text-left">
                <span className="mt-0.5 shrink-0 text-success text-sm" aria-hidden>✓</span>
                <p className="text-sm leading-snug text-app-text min-w-0">
                  <span className="block text-xs uppercase tracking-wide text-success mb-0.5">
                    {t('game.correctAnswerWas')}
                  </span>
                  <span className="font-semibold break-words">{correctAnswer}</span>
                </p>
              </div>
            )}

            {resultHint && <p className="text-center text-xs leading-snug text-app-secondary">{resultHint}</p>}

            {resultAttribution && (
              <div className="text-center text-[0.65rem] leading-snug text-app-subtle sm:text-xs">
                {resultAttribution}
              </div>
            )}

            {nextLabel && onNext && (
              <Button
                onClick={onNext}
                disabled={isSubmitting}
                variant="secondary"
                fullWidth
                className="sticky bottom-0"
              >
                {nextLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
