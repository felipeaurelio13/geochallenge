import { useCallback, useEffect, useMemo, useState } from 'react';

export function useImageWithFallback(primaryUrl: string | undefined) {
  const [src, setSrc] = useState(primaryUrl ?? '');
  const [hasError, setHasError] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);

  const fallbackUrl = useMemo(() => {
    if (!primaryUrl) return '';
    return primaryUrl.replace(
      'https://cdn.jsdelivr.net/gh/djaiss/mapsicon@master/all/',
      'https://raw.githubusercontent.com/djaiss/mapsicon/master/all/'
    );
  }, [primaryUrl]);

  const handleError = useCallback(() => {
    if (!triedFallback && fallbackUrl && fallbackUrl !== src) {
      setTriedFallback(true);
      setSrc(fallbackUrl);
    } else {
      setHasError(true);
    }
  }, [triedFallback, fallbackUrl, src]);

  useEffect(() => {
    setSrc(primaryUrl ?? '');
    setHasError(false);
    setTriedFallback(false);
  }, [primaryUrl]);

  return { src, hasError, handleError };
}
