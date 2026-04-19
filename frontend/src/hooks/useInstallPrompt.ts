import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_STORAGE_KEY = 'geochallenge:install-dismissed-at';
const VISIT_COUNT_KEY = 'geochallenge:visit-count';
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const MIN_VISITS_BEFORE_PROMPT = 2;

function readNumber(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : Number(raw) || fallback;
  } catch {
    return fallback;
  }
}

function writeNumber(key: string, value: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // noop
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const iosStandalone = (window.navigator as any)?.standalone === true;
  return Boolean(mq || iosStandalone);
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isDismissedRecently(): boolean {
  const dismissedAt = readNumber(DISMISS_STORAGE_KEY, 0);
  if (!dismissedAt) return false;
  return Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canShow, setCanShow] = useState(false);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const visits = readNumber(VISIT_COUNT_KEY, 0) + 1;
    writeNumber(VISIT_COUNT_KEY, visits);

    const evaluate = (event?: BeforeInstallPromptEvent) => {
      if (installed || isStandalone()) return;
      if (isDismissedRecently()) return;
      if (visits < MIN_VISITS_BEFORE_PROMPT) return;
      if (event) setDeferredPrompt(event);
      setCanShow(true);
    };

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      evaluate(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setCanShow(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall as EventListener);
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari has no beforeinstallprompt, but we can still show a manual hint.
    if (isIOS() && !installed && !isDismissedRecently() && visits >= MIN_VISITS_BEFORE_PROMPT) {
      setCanShow(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall as EventListener);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [installed]);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return 'unsupported' as const;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setCanShow(false);
      return choice.outcome;
    } catch {
      return 'error' as const;
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    writeNumber(DISMISS_STORAGE_KEY, Date.now());
    setCanShow(false);
  }, []);

  return {
    canShow,
    installed,
    promptInstall,
    dismiss,
    hasNativePrompt: Boolean(deferredPrompt),
    isIOS: isIOS(),
  };
}
