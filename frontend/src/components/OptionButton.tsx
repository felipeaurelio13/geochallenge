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
      'w-full rounded-2xl text-left transition-all duration-200 flex items-start gap-3 overflow-hidden border-2 px-3 py-3 min-h-[54px] sm:items-center sm:px-4 sm:py-3.5 sm:min-h-[64px]';

    if (showResult) {
      if (isCorrect) {
        return `${baseClasses} bg-green-600/25 border-green-400 text-green-100`;
      }
      if (selected && !isCorrect) {
        return `${baseClasses} bg-red-600/20 border-red-400 text-red-100`;
      }
      return `${baseClasses} bg-gray-800/70 border-gray-700 text-gray-500 opacity-60`;
    }

    if (selected) {
      return `${baseClasses} bg-primary/20 border-primary text-white ring-2 ring-primary/60 shadow-lg shadow-primary/20`;
    }

    if (disabled) {
      return `${baseClasses} bg-gray-800 border-gray-700 text-gray-400 cursor-not-allowed`;
    }

    return `${baseClasses} bg-gray-800/95 border-gray-700 text-white hover:border-primary/80 hover:bg-gray-700/80 cursor-pointer`;
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={getButtonClasses()}
      aria-pressed={selected}
    >
      <span
        className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-colors ${
          showResult && isCorrect
            ? 'bg-green-500 text-white'
            : showResult && selected && !isCorrect
              ? 'bg-red-500 text-white'
              : selected
                ? 'bg-white text-primary'
                : 'bg-gray-700 text-gray-200'
        }`}
      >
        {optionLetters[index]}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0 text-[0.95rem] font-medium leading-tight [overflow-wrap:anywhere] sm:text-lg md:text-xl">
          {option}
        </span>

        <div className="inline-flex items-center self-start sm:self-auto">
          {selected && !showResult && (
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/50 bg-white/15 text-sm font-semibold text-white shadow-sm shadow-black/20">
              ✓
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
        </div>
      </div>
    </button>
  );
}
