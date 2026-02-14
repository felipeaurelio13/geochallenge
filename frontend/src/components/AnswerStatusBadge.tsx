interface AnswerStatusBadgeProps {
  status: 'correct' | 'incorrect';
  label: string;
  className?: string;
}

export function AnswerStatusBadge({ status, label, className = '' }: AnswerStatusBadgeProps) {
  const isCorrect = status === 'correct';

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${
        isCorrect
          ? 'border-green-400/60 bg-green-500/15 text-green-300'
          : 'border-red-400/60 bg-red-500/15 text-red-300'
      } ${className}`}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
          isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}
        aria-hidden
      >
        {isCorrect ? '✓' : '✕'}
      </span>
      {label}
    </span>
  );
}

