interface OptionButtonProps {
  option: string;
  index: number;
  onClick: () => void;
  disabled: boolean;
  selected: boolean;
  isCorrect?: boolean;
  showResult: boolean;
}

const optionLetters = ['A', 'B', 'C', 'D'];

export function OptionButton({
  option,
  index,
  onClick,
  disabled,
  selected,
  isCorrect,
  showResult,
}: OptionButtonProps) {
  const baseClasses =
    'w-full rounded-2xl text-left transition-all duration-200 flex items-start gap-2 overflow-hidden border-2 px-3 py-2 option-button-base sm:items-center sm:px-3.5 sm:py-2.5';

  const defaultStateClasses =
    'bg-[var(--color-surface-muted)] border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-primary-300)] hover:bg-[var(--color-surface)] cursor-pointer';
  const selectedStateClasses =
    'bg-[var(--color-primary-900)] border-[var(--color-primary-400)] text-[var(--color-text-primary)] ring-2 ring-[var(--color-primary-400)]/80 shadow-lg shadow-[var(--color-primary-900)]/40';
  const disabledStateClasses =
    'bg-[var(--color-surface-muted)] border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed';
  const lockedStateClasses =
    'bg-[var(--color-surface-muted)] border-[var(--color-border)] text-[var(--color-text-secondary)] cursor-not-allowed';
  const correctStateClasses =
    'bg-[var(--color-success-600)] border-[var(--color-success-500)] text-white cursor-not-allowed';
  const wrongStateClasses =
    'bg-[var(--color-error-600)] border-[var(--color-error-500)] text-white cursor-not-allowed';

  const getButtonClasses = () => {
    if (showResult) {
      if (isCorrect) return `${baseClasses} ${correctStateClasses}`;
      if (selected && !isCorrect) return `${baseClasses} ${wrongStateClasses}`;
      return `${baseClasses} ${lockedStateClasses}`;
    }

    if (selected) return `${baseClasses} ${selectedStateClasses}`;
    if (disabled) return `${baseClasses} ${disabledStateClasses}`;
    return `${baseClasses} ${defaultStateClasses}`;
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={getButtonClasses()}
      aria-pressed={selected}
      data-state={showResult ? (isCorrect ? 'correct' : selected ? 'wrong' : 'locked') : selected ? 'selected' : disabled ? 'disabled' : 'default'}
    >
      <span
        className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-colors ${
          showResult && isCorrect
            ? 'bg-[var(--color-success-500)] text-white'
            : showResult && selected && !isCorrect
              ? 'bg-[var(--color-error-500)] text-white'
              : selected
                ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-800)]'
                : 'bg-[var(--color-border)] text-[var(--color-text-secondary)]'
        }`}
      >
        {showResult && isCorrect ? '✓' : showResult && selected && !isCorrect ? '✕' : optionLetters[index]}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0 text-[0.84rem] font-medium leading-tight truncate sm:text-[0.94rem] md:text-base">
          {option}
        </span>

        {selected && !showResult && (
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-full border border-[var(--color-primary-200)] bg-[var(--color-primary-500)] text-sm font-semibold text-white shadow-sm shadow-black/20 sm:self-auto">
            ✓
          </span>
        )}
      </div>
    </button>
  );
}
