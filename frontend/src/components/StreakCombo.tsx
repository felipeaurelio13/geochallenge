import { useEffect, useRef, useState } from 'react';
import { useUiStore } from '../store/useUiStore';

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
  const prefersReducedMotion = useUiStore((state) => state.prefersReducedMotion);
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
    ? 'border-warning-500 bg-warning-500/10 text-warning-500'
    : isActive
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-app-border bg-app-muted text-app-subtle';

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 shadow-sm ${tone} ${
        milestone && !prefersReducedMotion ? 'combo-flash' : ''
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
