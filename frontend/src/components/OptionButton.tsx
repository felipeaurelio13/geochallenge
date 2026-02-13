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
      'w-full p-4 rounded-lg text-left transition-all duration-200 flex items-center gap-4 border-2';

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
      return `${baseClasses} bg-primary border-primary text-white`;
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
      {showResult && isCorrect && (
        <span className="text-green-400">✓</span>
      )}
      {showResult && selected && !isCorrect && (
        <span className="text-red-400">✗</span>
      )}
    </button>
  );
}
