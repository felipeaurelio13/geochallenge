interface ProgressBarProps {
  current: number;
  total: number;
  correctAnswers: number;
}

export function ProgressBar({ current, total, correctAnswers }: ProgressBarProps) {
  const percentage = (current / total) * 100;

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Question indicators */}
      <div className="flex justify-between mt-2">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
              i < current
                ? i < correctAnswers
                  ? 'bg-green-500 text-white'
                  : 'bg-red-500 text-white'
                : i === current
                ? 'bg-primary text-white ring-2 ring-primary ring-offset-2 ring-offset-gray-900'
                : 'bg-gray-700 text-gray-500'
            }`}
          >
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}
