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
  const getButtonClasses = () => {
    const baseClasses =
      'relative w-full p-4 min-h-[52px] rounded-lg text-left transition-all duration-200 flex items-center gap-4 border-2 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60';

    if (showResult) {
      if (isCorrect) {
        return `${baseClasses} bg-green-900 border-green-500 text-green-100`;
      }
      if (selected && !isCorrect) {
        return `${baseClasses} bg-red-900 border-red-500 text-red-100`;
      }
      return `${baseClasses} bg-gray-800 border-gray-700 text-gray-500 opacity-50`;
    }

    if (selected) {
      return `${baseClasses} bg-primary border-primary text-white ring-2 ring-primary/40 shadow-lg shadow-primary/25`;
    }

    if (disabled) {
      return `${baseClasses} bg-gray-800 border-gray-700 text-gray-400 cursor-not-allowed`;
    }

    return `${baseClasses} bg-gray-800 border-gray-700 text-white hover:border-primary hover:bg-gray-700 cursor-pointer`;
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={getButtonClasses()}
      aria-pressed={selected}
    >
      <span
        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
          showResult && isCorrect
            ? 'bg-green-500 text-white'
            : showResult && selected && !isCorrect
            ? 'bg-red-500 text-white'
            : selected
            ? 'bg-white text-primary'
            : 'bg-gray-700 text-gray-300'
        }`}
      >
        {optionLetters[index]}
      </span>
      <span className="flex-1 font-medium">{option}</span>
      {!showResult && selected && (
        <span
          className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white/20 px-2 text-xs font-semibold text-white"
          aria-label="Opción seleccionada"
        >
          ✓
        </span>
      )}
      {showResult && isCorrect && (
        <span className="text-green-400">✓</span>
      )}
      {showResult && selected && !isCorrect && (
        <span className="text-red-400">✗</span>
      )}
    </button>
  );
}
