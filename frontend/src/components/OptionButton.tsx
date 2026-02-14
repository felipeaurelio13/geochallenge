import { useTranslation } from 'react-i18next';
import { AnswerStatusBadge } from './AnswerStatusBadge';

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
  const { t } = useTranslation();

  const getButtonClasses = () => {
    const baseClasses =
      'w-full rounded-xl text-left transition-all duration-200 flex items-start gap-2 border-2 px-2.5 py-2 min-h-[44px] sm:items-center sm:gap-3 sm:px-3 sm:py-2.5 sm:min-h-[52px]';

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
      return `${baseClasses} bg-primary border-primary text-white ring-4 ring-primary/30 shadow-lg shadow-primary/30 scale-[1.01]`;
    }

    if (disabled) {
      return `${baseClasses} bg-gray-800 border-gray-700 text-gray-400 cursor-not-allowed`;
    }

    return `${baseClasses} bg-gray-800 border-gray-700 text-white hover:border-primary/80 hover:bg-gray-700 cursor-pointer`;
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={getButtonClasses()}
      aria-pressed={selected}
    >
      <span
        className={`mt-0.5 h-7 w-7 shrink-0 rounded-full flex items-center justify-center font-bold text-[11px] transition-colors sm:mt-0 sm:h-8 sm:w-8 sm:text-xs ${
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
      <span className="flex-1 text-xs font-medium leading-snug sm:text-sm">{option}</span>
      {selected && !showResult && (
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/50 bg-white/20 text-[10px] font-semibold text-white shadow-sm shadow-black/20 sm:hidden">
          ✓
        </span>
      )}
      {selected && !showResult && (
        <span className="hidden md:inline-flex items-center rounded-full border border-white/50 bg-white/20 px-2 py-1 text-[11px] font-semibold text-white shadow-sm shadow-black/20">
          ✓ {t('game.selectedOption')}
        </span>
      )}
      {showResult && isCorrect && (
        <AnswerStatusBadge
          status="correct"
          label={t('game.correctLabel')}
          className="text-xs"
        />
      )}
      {showResult && selected && !isCorrect && (
        <AnswerStatusBadge
          status="incorrect"
          label={t('game.incorrectLabel')}
          className="text-xs"
        />
      )}
    </button>
  );
}
