import { useEffect, useRef, useState } from 'react';

interface StreakComboProps {
  combo: number;
  multiplier?: number;
  label?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * Animated combo badge used in Flash mode and Streak mode.
 * Pops on combo change; flashes on milestone thresholds (every 5).
 */
export function StreakCombo({
  combo,
  multiplier,
  label = 'Combo',
  className,
  'aria-label': ariaLabel,
}: StreakComboProps) {
  const [popKey, setPopKey] = useState(0);
  const prevRef = useRef(combo);
  const milestone = combo > 0 && combo % 5 === 0 && combo !== prevRef.current;

  useEffect(() => {
    if (combo !== prevRef.current) {
      setPopKey((k) => k + 1);
      prevRef.current = combo;
    }
  }, [combo]);

  const isActive = combo > 0;
  const tone = milestone
    ? 'from-amber-400 to-orange-500 border-amber-300 text-amber-950'
    : isActive
      ? 'from-primary to-blue-500 border-primary/50 text-white'
      : 'from-gray-700 to-gray-800 border-gray-600 text-gray-300';

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-2xl border bg-gradient-to-br px-3 py-1.5 shadow-lg ${tone} ${
        milestone ? 'combo-flash' : ''
      } ${className ?? ''}`}
      aria-label={ariaLabel ?? `${label} ${combo}`}
      role="status"
      aria-live="polite"
    >
      <span className="text-xs font-semibold uppercase tracking-wide opacity-90">{label}</span>
      <span
        key={popKey}
        className={`text-lg font-black tabular-nums ${isActive ? 'combo-pop' : ''}`}
      >
        {combo}
      </span>
      {typeof multiplier === 'number' && multiplier > 1 && (
        <span className="ml-1 rounded-md bg-black/30 px-1.5 py-0.5 text-xs font-bold">
          x{multiplier}
        </span>
      )}
    </div>
  );
}
