import { useEffect } from 'react';

export function useImagePreloader(urls: string[], skip = 1, concurrency = 3): void {
  useEffect(() => {
    const toLoad = urls.slice(skip).filter(Boolean);
    if (toLoad.length === 0) return;

    let cancelled = false;
    let nextIndex = 0;

    function loadNext(): void {
      if (cancelled) return;
      const idx = nextIndex++;
      if (idx >= toLoad.length) return;
      const img = new window.Image();
      img.onload = () => { if (!cancelled) loadNext(); };
      img.onerror = () => { if (!cancelled) loadNext(); };
      img.src = toLoad[idx];
    }

    for (let w = 0; w < Math.min(concurrency, toLoad.length); w++) {
      loadNext();
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls]);
}
