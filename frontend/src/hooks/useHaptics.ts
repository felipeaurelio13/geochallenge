import { useCallback, useMemo } from 'react';
import { getUiStoreSnapshot, useUiStore } from '../store/useUiStore';

export type HapticPattern = 'tap' | 'success' | 'error' | 'celebrate' | 'urgency';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 10,
  success: 30,
  error: [50, 30, 50],
  celebrate: [20, 40, 20, 40, 80],
  urgency: [15, 100, 15],
};

function vibrateSafe(pattern: number | number[]): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(pattern);
  } catch {
    // noop: some browsers throw on invalid patterns or user-gesture requirements
  }
}

export function triggerHaptic(pattern: HapticPattern): void {
  const { hapticsEnabled } = getUiStoreSnapshot();
  if (!hapticsEnabled) return;
  vibrateSafe(PATTERNS[pattern]);
}

export function useHaptics() {
  const hapticsEnabled = useUiStore((s) => s.hapticsEnabled);

  const fire = useCallback(
    (pattern: HapticPattern) => {
      if (!hapticsEnabled) return;
      vibrateSafe(PATTERNS[pattern]);
    },
    [hapticsEnabled]
  );

  return useMemo(
    () => ({
      enabled: hapticsEnabled,
      tap: () => fire('tap'),
      success: () => fire('success'),
      error: () => fire('error'),
      celebrate: () => fire('celebrate'),
      urgency: () => fire('urgency'),
    }),
    [fire, hapticsEnabled]
  );
}
