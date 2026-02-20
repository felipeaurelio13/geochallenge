import { PointerEvent, useMemo, useRef } from 'react';


type GestureOptions = {
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onTap?: () => void;
};

export function useGesture(options: GestureOptions) {
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  return useMemo(
    () => ({
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        pointerStart.current = { x: event.clientX, y: event.clientY };
      },
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        if (!pointerStart.current) {
          return;
        }

        const deltaX = event.clientX - pointerStart.current.x;
        const deltaY = event.clientY - pointerStart.current.y;
        const threshold = options.threshold ?? 45;
        const isHorizontalSwipe = Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY);

        if (isHorizontalSwipe) {
          if (deltaX > 0) {
            options.onSwipeRight?.();
          } else {
            options.onSwipeLeft?.();
          }
        } else if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
          options.onTap?.();
        }

        pointerStart.current = null;
      },
      onPointerCancel: () => {
        pointerStart.current = null;
      },
    }),
    [options]
  );
}
