import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

type ModalContextValue = {
  onClose?: () => void;
};

const ModalContext = createContext<ModalContextValue>({});

type ModalRootProps = {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
};

function Root({ isOpen, onClose, children }: ModalRootProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus first focusable element inside the dialog
    requestAnimationFrame(() => {
      if (!dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    });

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  return (
    <ModalContext.Provider value={{ onClose }}>
      <div
        ref={dialogRef}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {children}
      </div>
    </ModalContext.Provider>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h2 id="modal-title" className="text-lg font-semibold text-white">
      {children}
    </h2>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-4 shadow-xl">{children}</div>;
}

function CloseButton({ children }: { children?: React.ReactNode }) {
  const { onClose } = useContext(ModalContext);
  const { t } = useTranslation();
  return (
    <button type="button" className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200" onClick={onClose}>
      {children ?? t('common.close')}
    </button>
  );
}

export const Modal = {
  Root,
  Title,
  Panel,
  CloseButton,
};
