import { useRef } from 'react';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

type OverlayModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

// Overlay keeps background locked while allowing controlled internal scroll.
export function OverlayModal({ isOpen, onClose, title, children }: OverlayModalProps) {
  const scrollableRef = useRef<HTMLDivElement>(null);
  useLockBodyScroll(scrollableRef, isOpen);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <div
        ref={scrollableRef}
        className="surface-panel max-h-[80svh] w-full max-w-lg overflow-y-auto rounded-2xl p-4"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-lg px-3 text-sm font-semibold text-gray-200 hover:bg-gray-800"
          >
            Cerrar
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
