import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function computeFallbackUrl(url: string): string {
  if (!url) return '';
  // Silhouette: jsDelivr → raw.githubusercontent
  const silhouetteFallback = url.replace(
    'https://cdn.jsdelivr.net/gh/djaiss/mapsicon@master/all/',
    'https://raw.githubusercontent.com/djaiss/mapsicon/master/all/'
  );
  if (silhouetteFallback !== url) return silhouetteFallback;
  // Flag: flagcdn.com → flagpedia.net
  const flagFallback = url.replace('https://flagcdn.com/', 'https://flagpedia.net/data/flags/');
  if (flagFallback !== url) return flagFallback;
  return url;
}

export function useImageWithFallback(primaryUrl: string | undefined, onFinalError?: () => void) {
  const [src, setSrc] = useState(primaryUrl ?? '');
  const [hasError, setHasError] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);

  // Always up-to-date on every render — no effect lag
  const activeUrlRef = useRef(primaryUrl);
  activeUrlRef.current = primaryUrl;

  // Keep stable reference to the callback so it doesn't trigger re-memos
  const onFinalErrorRef = useRef(onFinalError);
  onFinalErrorRef.current = onFinalError;

  const fallbackUrl = useMemo(() => computeFallbackUrl(primaryUrl ?? ''), [primaryUrl]);

  const handleError = useCallback(() => {
    const activePrimary = activeUrlRef.current ?? '';
    const activeFallback = computeFallbackUrl(activePrimary);
    // Discard stale errors from a previous question's in-flight image request
    if (src !== activePrimary && src !== activeFallback) return;

    if (!triedFallback && fallbackUrl && fallbackUrl !== src) {
      setTriedFallback(true);
      setSrc(fallbackUrl);
    } else {
      setHasError(true);
      onFinalErrorRef.current?.();
    }
  }, [triedFallback, fallbackUrl, src]);

  useEffect(() => {
    setSrc(primaryUrl ?? '');
    setHasError(false);
    setTriedFallback(false);
  }, [primaryUrl]);

  return { src, hasError, handleError };
}
