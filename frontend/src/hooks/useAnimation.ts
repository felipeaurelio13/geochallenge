import { useCallback, useEffect, useState } from 'react';

export function useAnimation(durationMs = 250) {
  const [isAnimating, setIsAnimating] = useState(false);

  const triggerAnimation = useCallback(() => {
    setIsAnimating(true);
  }, []);

  useEffect(() => {
    if (!isAnimating) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsAnimating(false);
    }, durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [durationMs, isAnimating]);

  return {
    isAnimating,
    triggerAnimation,
  };
}
