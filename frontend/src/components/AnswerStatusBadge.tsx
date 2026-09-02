interface AnswerStatusBadgeProps {
  status: 'correct' | 'incorrect';
  label: string;
  className?: string;
}

export function AnswerStatusBadge({ status, label, className = '' }: AnswerStatusBadgeProps) {
  const isCorrect = status === 'correct';

  return (
    <span
      className={`inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold ${
        isCorrect
          ? 'border-success/60 bg-success/15 text-success'
          : 'border-error/60 bg-error/15 text-error'
      } ${className}`}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
          isCorrect ? 'bg-success text-app-on-accent' : 'bg-error text-app-on-accent'
        }`}
        aria-hidden
      >
        {isCorrect ? '✓' : '✕'}
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}
