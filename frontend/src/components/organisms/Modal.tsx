import React, { createContext, useContext } from 'react';

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
  if (!isOpen) {
    return null;
  }

  return (
    <ModalContext.Provider value={{ onClose }}>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center" role="dialog" aria-modal>
        {children}
      </div>
    </ModalContext.Provider>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-4 shadow-xl">{children}</div>;
}

function CloseButton({ children = 'Cerrar' }: { children?: React.ReactNode }) {
  const { onClose } = useContext(ModalContext);
  return (
    <button type="button" className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-200" onClick={onClose}>
      {children}
    </button>
  );
}

export const Modal = {
  Root,
  Panel,
  CloseButton,
};
