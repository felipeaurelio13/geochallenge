import { useEffect, useState } from 'react';

type WindowSize = {
  width: number;
  height: number;
};

const FALLBACK_SIZE: WindowSize = { width: 0, height: 0 };

export function useWindowSize() {
  const [size, setSize] = useState<WindowSize>(() => {
    if (typeof window === 'undefined') {
      return FALLBACK_SIZE;
    }

    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}
