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
      <div className="h-3 rounded-full bg-gray-700/80 p-0.5" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="scrollbar-none mt-3.5 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:justify-between sm:overflow-visible sm:px-0 sm:pb-0" role="list" aria-label="Progreso de preguntas">
        {Array.from({ length: total }, (_, i) => {
          const status = getQuestionIndicatorStatus(i, current, results);

          return (
            <div
              key={i}
              role="listitem"
              aria-label={`Pregunta ${i + 1} ${status}`}
              className={`h-10 w-10 shrink-0 rounded-full border text-sm font-semibold transition-all duration-300 flex items-center justify-center ${
                status === 'correct'
                  ? 'border-green-400 bg-green-500 text-white'
                  : status === 'incorrect'
                    ? 'border-red-400 bg-red-500 text-white'
                    : status === 'current'
                      ? 'border-primary/80 bg-primary/25 text-white ring-2 ring-primary/70 ring-offset-2 ring-offset-gray-900'
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
