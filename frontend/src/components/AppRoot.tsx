import React, { useEffect } from 'react';
import { useMediaQuery, useWindowSize } from '../hooks';
import { uiStoreActions } from '../store/useUiStore';

// AppRoot provides stable viewport sizing and safe-area padding for mobile browsers.
export function AppRoot({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowSize();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const { setIsMobile, setViewport, setPrefersReducedMotion } = uiStoreActions;

  useEffect(() => {
    setViewport(width, height);
  }, [height, setViewport, width]);

  useEffect(() => {
    setIsMobile(isMobile);
  }, [isMobile, setIsMobile]);

  useEffect(() => {
    setPrefersReducedMotion(prefersReducedMotion);
  }, [prefersReducedMotion, setPrefersReducedMotion]);

  return <div className="app-root">{children}</div>;
}
