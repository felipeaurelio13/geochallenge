interface AccentConfig {
  border: string;
  icon: string;
  hover: string;
}

interface GameModeCardProps {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
  disabledHint?: string;
  className?: string;
  accent?: AccentConfig;
}

export function GameModeCard({
  icon,
  title,
  description,
  onClick,
  disabled = false,
  disabledHint,
  className = '',
  accent,
}: GameModeCardProps) {
  const borderClass = accent ? accent.border : 'border-app-border';
  const hoverClass = accent
    ? `${accent.hover} hover:shadow-sm`
    : 'hover:border-primary/35 hover:bg-app-muted/90 hover:shadow-sm';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      aria-disabled={disabled || undefined}
      className={`pressable rounded-2xl border ${borderClass} bg-app-surface/80 py-2.5 px-3 text-left transition-all ${hoverClass} disabled:opacity-50 disabled:cursor-not-allowed sm:py-3 sm:px-4 ${className}`}
    >
      <h3 className="flex items-center gap-2 text-base font-bold text-app-text sm:text-lg">
        <span aria-hidden="true" className={accent?.icon}>{icon}</span>
        {title}
      </h3>
      <p className="mt-0.5 text-xs leading-snug text-app-subtle sm:text-[0.82rem]">
        {disabled && disabledHint ? disabledHint : description}
      </p>
    </button>
  );
}
