import { ReactNode } from 'react';
import { AnswerStatusBadge } from './AnswerStatusBadge';

type RoundActionTrayProps = {
  mode?: 'single' | 'duel' | 'challenge';
  showResult: boolean;
  canSubmit: boolean;
  isWaiting?: boolean;
  isSubmitting?: boolean;
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
  summarySlot?: ReactNode;
};

const MODE_CONTAINER_CLASS: Record<NonNullable<RoundActionTrayProps['mode']>, string> = {
  single:
    'w-full border-t border-gray-700/80 bg-gradient-to-t from-gray-950 via-gray-900/96 to-gray-900/65 px-3 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-[clamp(0.35rem,1.6dvh,0.55rem)] backdrop-blur sm:px-4',
  duel:
    'w-full border-t border-gray-700/80 bg-gradient-to-t from-gray-950 via-gray-900/96 to-gray-900/65 px-3 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-[clamp(0.35rem,1.6dvh,0.55rem)] backdrop-blur sm:px-4',
  challenge:
    'w-full border-t border-gray-700/80 bg-gradient-to-t from-gray-950 via-gray-900/96 to-gray-900/65 px-3 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] pt-[clamp(0.35rem,1.6dvh,0.55rem)] backdrop-blur sm:px-4',
};

export function RoundActionTray({
  mode = 'single',
  showResult,
  canSubmit,
  isWaiting = false,
  isSubmitting = false,
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
  summarySlot,
}: RoundActionTrayProps) {
  const wrapperClassName =
    mode === 'challenge'
      ? 'mx-auto flex w-full max-w-4xl flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between'
      : 'mx-auto flex w-full max-w-4xl flex-col gap-1 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-900/96 via-gray-900/96 to-emerald-950/45 p-[clamp(0.4rem,1.5dvh,0.55rem)] shadow-xl shadow-cyan-950/30 sm:flex-row sm:items-center sm:justify-between';

  return (
    <div className={MODE_CONTAINER_CLASS[mode]} data-testid="mobile-action-tray">
      <div className={wrapperClassName}>
        {summarySlot}

        {!showResult && !isWaiting && (
          <div className="flex flex-1 flex-col justify-center gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="w-full sm:w-auto rounded-2xl border border-emerald-200/35 bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 px-6 py-2 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-900/45 transition-all duration-150 hover:from-cyan-400 hover:via-sky-400 hover:to-emerald-400 hover:shadow-cyan-700/55 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-cyan-200/80 disabled:cursor-not-allowed disabled:border-sky-300/25 disabled:bg-slate-600/95 disabled:bg-none disabled:text-slate-100/85 disabled:shadow-none disabled:opacity-90 sm:text-base"
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
          <div className="w-full rounded-2xl border border-gray-700 bg-gray-800/95 p-2 text-center backdrop-blur-sm shadow-sm shadow-black/30 sm:p-4">
            {showResultBadge && resultLabel && (
              <AnswerStatusBadge
                status={isCorrect ? 'correct' : 'incorrect'}
                label={resultLabel}
                className="mb-2.5 text-sm"
              />
            )}

            {resultHint && <p className="mb-2.5 text-xs leading-relaxed text-gray-200 sm:text-sm">{resultHint}</p>}

            {nextLabel && onNext && (
              <button
                type="button"
                onClick={onNext}
                disabled={isSubmitting}
                className="w-full sm:w-auto rounded-2xl px-6 py-2 bg-primary text-white text-sm sm:text-base font-bold shadow-md shadow-primary/30 hover:bg-primary/85 active:scale-[0.99] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/70 disabled:cursor-wait disabled:opacity-70"
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
