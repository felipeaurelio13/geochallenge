import React, { useEffect, useState } from 'react';
import { useMediaQuery, useWindowSize } from '../hooks';
import { uiStoreActions } from '../store/useUiStore';
import { InstallPromptBanner } from './InstallPromptBanner';

// AppRoot provides stable viewport sizing and safe-area padding for mobile browsers.
export function AppRoot({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowSize();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const { setIsMobile, setViewport, setPrefersReducedMotion } = uiStoreActions;
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    setViewport(width, height);
  }, [height, setViewport, width]);

  useEffect(() => {
    setIsMobile(isMobile);
  }, [isMobile, setIsMobile]);

  useEffect(() => {
    setPrefersReducedMotion(prefersReducedMotion);
  }, [prefersReducedMotion, setPrefersReducedMotion]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="app-root">
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 top-0 z-40 bg-amber-500/95 px-3 py-1 text-center text-xs font-semibold text-amber-950 shadow"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.25rem)' }}
        >
          📴 Modo offline · algunas funciones están limitadas
        </div>
      )}
      {children}
      <InstallPromptBanner />
    </div>
  );
}
