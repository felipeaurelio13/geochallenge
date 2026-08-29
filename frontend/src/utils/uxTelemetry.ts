import { featureFlags } from '../config/featureFlags';

type ClientEventName =
  | 'app_open'
  | 'mode_selected'
  | 'game_abandoned'
  | 'round_timeout'
  | 'option_mis_tap'
  | 'ui_error';

interface ClientEvent {
  eventKey: string;
  name: ClientEventName;
  clientSessionId: string;
  occurredAt: string;
  properties?: Record<string, unknown>;
}

const STORAGE_KEY = 'geochallenge:ux-telemetry-buffer';
const SESSION_KEY = 'geochallenge:ux-telemetry-session';
const MAX_BUFFER = 200;
const FLUSH_THRESHOLD = 20;
const FLUSH_INTERVAL_MS = 10_000;
const TELEMETRY_ENDPOINT = '/api/telemetry/events';

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    let sid = window.sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      window.sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return crypto.randomUUID();
  }
}

function readBuffer(): ClientEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_BUFFER) : [];
  } catch {
    return [];
  }
}

function writeBuffer(events: ClientEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_BUFFER)));
  } catch {
    // noop
  }
}

function removeFromBuffer(eventKeys: string[]): void {
  const keySet = new Set(eventKeys);
  const buffer = readBuffer().filter((e) => !keySet.has(e.eventKey));
  writeBuffer(buffer);
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem('token');
  } catch {
    return null;
  }
}

async function flush(): Promise<void> {
  if (isFlushing) return;

  const buffer = readBuffer();
  if (buffer.length === 0) return;

  isFlushing = true;

  try {
    const token = getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: buffer.slice(0, 50) }),
    });

    if (response.ok) {
      const sent = buffer.slice(0, 50).map((e) => e.eventKey);
      removeFromBuffer(sent);
    }
    // On non-2xx (including 503 TELEMETRY_UNAVAILABLE), keep events in buffer.
  } catch {
    // network error: keep events in buffer for retry
  } finally {
    isFlushing = false;
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush().catch(() => {});
  }, FLUSH_INTERVAL_MS);
}

function urgentFlush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  const buffer = readBuffer();
  if (buffer.length === 0) return;

  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Primary: fetch with keepalive + Authorization.
  // sendBeacon is not used for authenticated telemetry because it cannot
  // set Authorization headers and would strip user identity.
  fetch(TELEMETRY_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ events: buffer.slice(0, 50) }),
    keepalive: true,
  }).catch(() => {
    // If fetch fails and no token is set, try anonymous sendBeacon as last-resort fallback.
    if (!token) {
      try {
        navigator.sendBeacon(
          TELEMETRY_ENDPOINT,
          new Blob([JSON.stringify({ events: buffer.slice(0, 50) })], { type: 'application/json' })
        );
      } catch {
        // both paths failed
      }
    }
  });
}

export function trackUxEvent(name: ClientEventName, properties?: Record<string, unknown>): void {
  if (!featureFlags.telemetry.enabled) return;

  const event: ClientEvent = {
    eventKey: crypto.randomUUID(),
    name,
    clientSessionId: getSessionId(),
    occurredAt: new Date().toISOString(),
    properties,
  };

  const buffer = [...readBuffer(), event];
  writeBuffer(buffer);

  if (featureFlags.telemetry.debugConsole) {
    console.info('[ux-telemetry]', event);
  }

  if (buffer.length >= FLUSH_THRESHOLD) {
    flush().catch(() => {});
  } else {
    scheduleFlush();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flush().catch(() => {});
  });

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      urgentFlush();
    }
  });

  window.addEventListener('pagehide', () => {
    urgentFlush();
  });

  scheduleFlush();
}

export function getClientSessionId(): string {
  return getSessionId();
}
