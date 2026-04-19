import { featureFlags } from '../config/featureFlags';

type UxEventName =
  | 'round_timeout'
  | 'round_abandon'
  | 'mechanic_used'
  | 'option_mis_tap'
  | 'round_submitted';

type UxEventPayload = {
  mode: 'single' | 'streak' | 'flash' | 'duel' | 'challenge';
  questionId?: string;
  value?: number;
  meta?: Record<string, string | number | boolean | null | undefined>;
};

const STORAGE_KEY = 'geochallenge:ux-telemetry-buffer';
const MAX_BUFFER_ITEMS = 50;

function readBuffer(): Array<{ name: UxEventName; payload: UxEventPayload; timestamp: string }> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<{ name: UxEventName; payload: UxEventPayload; timestamp: string }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBuffer(events: Array<{ name: UxEventName; payload: UxEventPayload; timestamp: string }>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_BUFFER_ITEMS)));
  } catch {
    // noop
  }
}

export function trackUxEvent(name: UxEventName, payload: UxEventPayload): void {
  if (!featureFlags.telemetry.enabled) return;

  const entry = {
    name,
    payload,
    timestamp: new Date().toISOString(),
  };

  const next = [...readBuffer(), entry];
  writeBuffer(next);

  if (featureFlags.telemetry.debugConsole) {
    console.info('[ux-telemetry]', entry);
  }
}

