import { useSyncExternalStore } from 'react';

type UiState = {
  isMobile: boolean;
  viewport: {
    width: number;
    height: number;
  };
  prefersReducedMotion: boolean;
};

let state: UiState = {
  isMobile: false,
  viewport: { width: 0, height: 0 },
  prefersReducedMotion: false,
};

const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const setState = (next: Partial<UiState>) => {
  state = { ...state, ...next };
  emit();
};

export const uiStoreActions = {
  setIsMobile: (value: boolean) => setState({ isMobile: value }),
  setViewport: (width: number, height: number) => setState({ viewport: { width, height } }),
  setPrefersReducedMotion: (value: boolean) => setState({ prefersReducedMotion: value }),
};

export function useUiStore<T>(selector: (store: UiState) => T) {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => selector(state)
  );
}
