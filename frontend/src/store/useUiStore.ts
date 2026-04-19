import { useSyncExternalStore } from 'react';

type UiState = {
  isMobile: boolean;
  viewport: {
    width: number;
    height: number;
  };
  prefersReducedMotion: boolean;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
};

const HAPTICS_STORAGE_KEY = 'geochallenge:haptics-enabled';
const SOUND_STORAGE_KEY = 'geochallenge:sound-enabled';

const readBoolPref = (key: string, fallback: boolean): boolean => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch {
    return fallback;
  }
};

const writeBoolPref = (key: string, value: boolean): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // noop: storage unavailable (private mode, quota)
  }
};

let state: UiState = {
  isMobile: false,
  viewport: { width: 0, height: 0 },
  prefersReducedMotion: false,
  hapticsEnabled: readBoolPref(HAPTICS_STORAGE_KEY, true),
  soundEnabled: readBoolPref(SOUND_STORAGE_KEY, false),
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
  setHapticsEnabled: (value: boolean) => {
    writeBoolPref(HAPTICS_STORAGE_KEY, value);
    setState({ hapticsEnabled: value });
  },
  setSoundEnabled: (value: boolean) => {
    writeBoolPref(SOUND_STORAGE_KEY, value);
    setState({ soundEnabled: value });
  },
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

export function getUiStoreSnapshot(): UiState {
  return state;
}
