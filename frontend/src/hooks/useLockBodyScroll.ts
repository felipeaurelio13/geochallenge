import { useEffect } from 'react';

export function useLockBodyScroll(scrollableRef: React.RefObject<HTMLElement>, isActive = true) {
  useEffect(() => {
    if (!isActive) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    const originalOverscrollBehavior = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';

    const element = scrollableRef.current;
    if (element) {
      element.style.overscrollBehavior = 'contain';
      element.style.setProperty('-webkit-overflow-scrolling', 'touch');
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      document.body.style.overscrollBehavior = originalOverscrollBehavior;
      if (element) {
        element.style.overscrollBehavior = '';
        element.style.removeProperty('-webkit-overflow-scrolling');
      }
    };
  }, [isActive, scrollableRef]);
}
