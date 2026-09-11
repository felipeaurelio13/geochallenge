import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let originalLocalStorage: PropertyDescriptor | undefined;
let originalSessionStorage: PropertyDescriptor | undefined;
let originalCrypto: PropertyDescriptor | undefined;
let addEventListenerSpy: {
  mock: { calls: Array<[string, EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions]> };
  mockRestore: () => void;
};

function installStorageMocks(): void {
  const local: Record<string, string> = {};
  const session: Record<string, string> = {};

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => local[key] ?? null,
      setItem: (key: string, value: string) => { local[key] = value; },
      removeItem: (key: string) => { delete local[key]; },
      clear: () => { Object.keys(local).forEach((key) => delete local[key]); },
    },
  });
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => session[key] ?? null,
      setItem: (key: string, value: string) => { session[key] = value; },
      removeItem: (key: string) => { delete session[key]; },
      clear: () => { Object.keys(session).forEach((key) => delete session[key]); },
    },
  });
}

function installCryptoMock(): void {
  Object.defineProperty(window, 'crypto', {
    configurable: true,
    value: { randomUUID: () => '00000000-0000-0000-0000-000000000001' },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  originalLocalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
  originalSessionStorage = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
  originalCrypto = Object.getOwnPropertyDescriptor(window, 'crypto');
  addEventListenerSpy = vi.spyOn(window, 'addEventListener') as typeof addEventListenerSpy;
  installStorageMocks();
  installCryptoMock();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
});

afterEach(() => {
  for (const call of addEventListenerSpy.mock.calls) {
    const [type, listener, options] = call;
    window.removeEventListener(type, listener, options);
  }
  addEventListenerSpy.mockRestore();
  if (originalLocalStorage) Object.defineProperty(window, 'localStorage', originalLocalStorage);
  if (originalSessionStorage) Object.defineProperty(window, 'sessionStorage', originalSessionStorage);
  if (originalCrypto) Object.defineProperty(window, 'crypto', originalCrypto);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('UX telemetry endpoint construction', () => {
  it('uses the configured backend URL without duplicating its trailing slash', async () => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.test/');
    const { trackUxEvent } = await import('../utils/uxTelemetry');

    for (let index = 0; index < 20; index += 1) trackUxEvent('app_open');
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.test/telemetry/events',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(vi.mocked(fetch).mock.calls[0][1]).not.toHaveProperty('keepalive');
  });

  it('falls back to the relative /api endpoint and uses keepalive on pagehide', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const { trackUxEvent } = await import('../utils/uxTelemetry');

    trackUxEvent('app_open');
    window.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    const calls = vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/telemetry/events');
    expect(calls).toHaveLength(1);
    const [, request] = calls[0];
    expect(request).toEqual(expect.objectContaining({ method: 'POST', keepalive: true }));
    expect(JSON.parse(String(request?.body))).toMatchObject({ events: [{ name: 'app_open' }] });
  });
});
