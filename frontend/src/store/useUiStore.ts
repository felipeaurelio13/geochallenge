import { useSyncExternalStore } from 'react';

export type ToastType = 'success' | 'info' | 'achievement';

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
  durationMs?: number;
};

type UiState = {
  isMobile: boolean;
  viewport: {
    width: number;
    height: number;
  };
  prefersReducedMotion: boolean;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  extendedTimeEnabled: boolean;
  toasts: Toast[];
};

const HAPTICS_STORAGE_KEY = 'geochallenge:haptics-enabled';
const SOUND_STORAGE_KEY = 'geochallenge:sound-enabled';
const EXTENDED_TIME_STORAGE_KEY = 'geochallenge:extended-time-enabled';

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
  // Defaults to false: vestibular/motor-sensitive users should opt in to haptics,
  // not opt out. Only applies to brand-new users/devices with no stored
  // preference yet — anyone with an explicit stored value keeps their choice.
  hapticsEnabled: readBoolPref(HAPTICS_STORAGE_KEY, false),
  soundEnabled: readBoolPref(SOUND_STORAGE_KEY, false),
  extendedTimeEnabled: readBoolPref(EXTENDED_TIME_STORAGE_KEY, false),
  toasts: [],
};

let toastIdCounter = 0;

const generateToastId = (): string => {
  toastIdCounter += 1;
  return `toast-${Date.now()}-${toastIdCounter}`;
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
  setExtendedTimeEnabled: (value: boolean) => {
    writeBoolPref(EXTENDED_TIME_STORAGE_KEY, value);
    setState({ extendedTimeEnabled: value });
  },
  pushToast: (toast: Omit<Toast, 'id'>): string => {
    const id = generateToastId();
    setState({ toasts: [...state.toasts, { ...toast, id }] });
    return id;
  },
  dismissToast: (id: string): void => {
    setState({ toasts: state.toasts.filter((toast) => toast.id !== id) });
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
