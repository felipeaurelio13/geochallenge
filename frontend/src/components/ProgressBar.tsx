interface ProgressBarProps {
  current: number;
  total: number;
  results: Array<{ isCorrect: boolean }>;
  showCurrentResult?: boolean;
}

export function getQuestionIndicatorStatus(
  index: number,
  current: number,
  results: Array<{ isCorrect: boolean }>,
  showCurrentResult = false
) {
  const currentIndex = Math.max(0, current - 1);

  if (index === currentIndex && !showCurrentResult) {
    return 'current';
  }

  const answeredCount = showCurrentResult ? results.length : Math.min(results.length, currentIndex);

  if (index < answeredCount) {
    return results[index]?.isCorrect ? 'correct' : 'incorrect';
  }

  if (index === currentIndex) {
    return 'current';
  }

  return 'pending';
}

export function ProgressBar({ current, total, results, showCurrentResult = false }: ProgressBarProps) {
  const safeTotal = Math.max(1, total);
  const indicatorGapPx = 4;
  const indicatorWidth = `calc((100% - ${(safeTotal - 1) * indicatorGapPx}px) / ${safeTotal})`;

  return (
    <div className="w-full">
      <div className="flex w-full flex-nowrap gap-1 overflow-hidden" role="list" aria-label="Progreso de preguntas">
        {Array.from({ length: total }, (_, i) => {
          const status = getQuestionIndicatorStatus(i, current, results, showCurrentResult);

          return (
            <div
              key={i}
              role="listitem"
              aria-label={`Pregunta ${i + 1} ${status}`}
              style={{ width: indicatorWidth }}
              className={`h-7 min-w-0 shrink-0 rounded-full border text-[0.66rem] font-semibold transition-all duration-300 flex items-center justify-center sm:h-8 sm:text-xs ${
                status === 'correct'
                  ? 'border-green-400 bg-green-500 text-white'
                  : status === 'incorrect'
                    ? 'border-red-400 bg-red-500 text-white'
                    : status === 'current'
                      ? 'border-amber-300 bg-amber-500/30 text-amber-100 ring-1 ring-amber-300/70'
                      : 'border-gray-600 bg-gray-700/80 text-gray-400'
              }`}
              aria-current={status === 'current' ? 'step' : undefined}
            >
              {i + 1}
            </div>
          );
        })}
      </div>
    </div>
  );
}
