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
  clearLabel: string;
  waitingLabel?: string;
  resultLabel?: string;
  selectionAssistiveText?: string;
  onSubmit: () => void;
  onNext?: () => void;
  onClear: () => void;
  showClearButton?: boolean;
  showResultBadge?: boolean;
  isCorrect?: boolean;
  resultHint?: string;
  summarySlot?: ReactNode;
};

const MODE_CONTAINER_CLASS: Record<NonNullable<RoundActionTrayProps['mode']>, string> = {
  single:
    'sticky bottom-0 z-20 mt-2 -mx-1 bg-gradient-to-t from-gray-900 via-gray-900/95 to-transparent px-1 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 sm:mx-0 sm:mt-3 sm:bg-none sm:px-0 sm:pb-0 sm:pt-0',
  duel:
    'sticky bottom-0 z-20 mt-2 -mx-1 bg-gradient-to-t from-gray-900 via-gray-900/95 to-transparent px-1 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 sm:mx-0 sm:mt-3 sm:bg-none sm:px-0 sm:pb-0 sm:pt-0',
  challenge:
    'fixed inset-x-0 bottom-0 z-20 border-t border-gray-700 bg-gradient-to-t from-gray-950 via-gray-900/95 to-gray-900/70 px-3 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-2.5 backdrop-blur sm:px-4',
};

export function RoundActionTray({
  mode = 'single',
  showResult,
  canSubmit,
  isWaiting = false,
  isSubmitting = false,
  submitLabel,
  nextLabel,
  clearLabel,
  waitingLabel,
  resultLabel,
  selectionAssistiveText,
  onSubmit,
  onNext,
  onClear,
  showClearButton = false,
  showResultBadge = false,
  isCorrect = false,
  resultHint,
  summarySlot,
}: RoundActionTrayProps) {
  const wrapperClassName = mode === 'challenge'
    ? 'mx-auto flex w-full max-w-4xl flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between'
    : 'rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-slate-900/96 via-gray-900/96 to-emerald-950/45 p-3.5 shadow-xl shadow-cyan-950/30 backdrop-blur-sm sm:bg-transparent sm:p-0 sm:border-0 sm:shadow-none sm:backdrop-blur-none';

  return (
    <div className={MODE_CONTAINER_CLASS[mode]} data-testid="mobile-action-tray">
      <div className={wrapperClassName}>
        {summarySlot}

        {!showResult && !isWaiting && (
          <div className="flex flex-1 flex-col justify-center gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {showClearButton && (
              <button
                type="button"
                onClick={onClear}
                className="w-full sm:w-auto rounded-2xl border border-cyan-300/45 bg-slate-900/70 px-5 py-3 text-base font-semibold text-cyan-100 transition-all duration-150 hover:border-cyan-200 hover:bg-slate-800/85 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <span aria-hidden>↺</span>
                  {clearLabel}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="w-full sm:w-auto rounded-2xl border border-emerald-200/35 bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-500 px-8 py-3.5 text-base font-bold text-slate-950 shadow-lg shadow-cyan-900/45 transition-all duration-150 hover:from-cyan-400 hover:via-sky-400 hover:to-emerald-400 hover:shadow-cyan-700/55 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-cyan-200/80 disabled:cursor-not-allowed disabled:border-gray-600/70 disabled:bg-gray-700 disabled:bg-none disabled:text-gray-300 disabled:shadow-none sm:text-lg"
            >
              {submitLabel}
            </button>

            {selectionAssistiveText && canSubmit && (
              <p className="w-full text-center text-xs text-cyan-100/85 sm:text-right">
                {selectionAssistiveText}
              </p>
            )}
          </div>
        )}

        {isWaiting && (
          <div className="w-full rounded-2xl border border-gray-700 bg-gray-800/95 p-3.5 text-center backdrop-blur-sm shadow-sm shadow-black/30">
            <p className="text-base text-gray-200">{waitingLabel}</p>
          </div>
        )}

        {showResult && (
          <div className="w-full text-center rounded-2xl border border-gray-700 bg-gray-800/95 p-3.5 sm:p-5 backdrop-blur-sm shadow-sm shadow-black/30">
            {showResultBadge && resultLabel && (
              <AnswerStatusBadge
                status={isCorrect ? 'correct' : 'incorrect'}
                label={resultLabel}
                className="mb-4 text-base"
              />
            )}

            {resultHint && <p className="mb-4 text-base leading-relaxed text-gray-200">{resultHint}</p>}

            {nextLabel && onNext && (
              <button
                type="button"
                onClick={onNext}
                disabled={isSubmitting}
                className="w-full sm:w-auto rounded-2xl px-8 py-3.5 bg-primary text-white text-base sm:text-xl font-bold shadow-md shadow-primary/30 hover:bg-primary/85 active:scale-[0.99] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary/70 disabled:cursor-wait disabled:opacity-70"
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
