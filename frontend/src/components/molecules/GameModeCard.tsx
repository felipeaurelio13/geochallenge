interface GameModeCardProps {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function GameModeCard({
  icon,
  title,
  description,
  onClick,
  disabled = false,
  className = '',
}: GameModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border border-gray-800 bg-gray-900 py-2.5 px-3 text-left transition-colors hover:border-gray-600 hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed sm:py-3 sm:px-4 ${className}`}
    >
      <h3 className="flex items-center gap-2 text-base font-bold text-white sm:text-lg">
        <span role="img">{icon}</span>
        {title}
      </h3>
      <p className="mt-0.5 text-xs leading-snug text-gray-400 sm:text-[0.82rem]">
        {description}
      </p>
    </button>
  );
}
