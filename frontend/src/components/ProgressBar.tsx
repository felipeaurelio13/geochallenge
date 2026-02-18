interface ProgressBarProps {
  current: number;
  total: number;
  results: Array<{ isCorrect: boolean }>;
}

export function getQuestionIndicatorStatus(
  index: number,
  current: number,
  results: Array<{ isCorrect: boolean }>
) {
  const answeredCount = results.length;

  if (index < answeredCount) {
    return results[index]?.isCorrect ? 'correct' : 'incorrect';
  }

  const currentIndex = Math.max(0, current - 1);

  if (index === currentIndex) {
    return 'current';
  }

  return 'pending';
}

export function ProgressBar({ current, total, results }: ProgressBarProps) {
  const percentage = (current / total) * 100;

  return (
    <div className="w-full">
      <div className="h-2 rounded-full bg-gray-700/80 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="scrollbar-none mt-3 flex items-center gap-2 overflow-x-auto pb-1 sm:justify-between sm:overflow-visible sm:pb-0">
        {Array.from({ length: total }, (_, i) => {
          const status = getQuestionIndicatorStatus(i, current, results);

          return (
            <div
              key={i}
              className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                status === 'correct'
                  ? 'bg-green-500 text-white'
                  : status === 'incorrect'
                  ? 'bg-red-500 text-white'
                  : status === 'current'
                  ? 'bg-primary text-white ring-2 ring-primary/70 ring-offset-2 ring-offset-gray-900'
                  : 'bg-gray-700 text-gray-400'
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
