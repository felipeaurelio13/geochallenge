import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const _ls: Record<string, string> = {};
const _ss: Record<string, string> = {};

const mockFetch = vi.fn().mockResolvedValue({ ok: true });
const mockSendBeacon = vi.fn().mockReturnValue(true);

Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: {
    getItem: (key: string) => _ls[key] ?? null,
    setItem: (key: string, value: string) => { _ls[key] = value; },
    removeItem: (key: string) => { delete _ls[key]; },
    clear: () => { Object.keys(_ls).forEach((k) => delete _ls[k]); },
  },
});

Object.defineProperty(window, 'sessionStorage', {
  writable: true,
  value: {
    getItem: (key: string) => _ss[key] ?? null,
    setItem: (key: string, value: string) => { _ss[key] = value; },
    removeItem: (key: string) => { delete _ss[key]; },
    clear: () => { Object.keys(_ss).forEach((k) => delete _ss[k]); },
  },
});

vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal('navigator', { sendBeacon: mockSendBeacon });

const cryptoUUID = vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000001');
Object.defineProperty(window, 'crypto', {
  writable: true,
  value: { randomUUID: cryptoUUID },
});

import { trackUxEvent, getClientSessionId } from '../utils/uxTelemetry';

beforeEach(() => {
  Object.keys(_ls).forEach((k) => delete _ls[k]);
  Object.keys(_ss).forEach((k) => delete _ss[k]);
  mockFetch.mockClear();
  mockSendBeacon.mockClear();
  mockFetch.mockResolvedValue({ ok: true });
  cryptoUUID.mockReturnValue('00000000-0000-0000-0000-000000000001');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('trackUxEvent', () => {
  it('stores events in localStorage buffer', () => {
    trackUxEvent('app_open');

    const raw = _ls['geochallenge:ux-telemetry-buffer'];
    expect(raw).toBeDefined();
    const buffer = JSON.parse(raw);
    expect(buffer).toHaveLength(1);
    expect(buffer[0].name).toBe('app_open');
  });

  it('creates persistent clientSessionId in sessionStorage', () => {
    trackUxEvent('app_open');

    const sid = _ss['geochallenge:ux-telemetry-session'];
    expect(sid).toBeDefined();
  });

  it('caps buffer at MAX_BUFFER (200)', () => {
    for (let i = 0; i < 250; i++) {
      trackUxEvent('app_open');
    }

    const raw = _ls['geochallenge:ux-telemetry-buffer'];
    const buffer = JSON.parse(raw);
    expect(buffer.length).toBeLessThanOrEqual(200);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('does not track when telemetry is disabled', async () => {
    const featureFlags = await import('../config/featureFlags');
    const original = featureFlags.featureFlags.telemetry.enabled;

    try {
      (featureFlags.featureFlags.telemetry as any).enabled = false;
      trackUxEvent('app_open');

      expect(_ls['geochallenge:ux-telemetry-buffer']).toBeUndefined();
    } finally {
      (featureFlags.featureFlags.telemetry as any).enabled = original;
    }
  });

  it('tracks game_abandoned with properties', () => {
    trackUxEvent('game_abandoned', { mode: 'single', roundIndex: 3, reason: 'navigation' });

    const raw = _ls['geochallenge:ux-telemetry-buffer'];
    const buffer = JSON.parse(raw);
    expect(buffer).toHaveLength(1);
    expect(buffer[0].name).toBe('game_abandoned');
    expect(buffer[0].properties.mode).toBe('single');
    expect(buffer[0].properties.roundIndex).toBe(3);
    expect(buffer[0].properties.reason).toBe('navigation');
  });

  it('tracks mode_selected with destination', () => {
    trackUxEvent('mode_selected', { destination: '/game/single', gameMode: 'single', category: 'MAP' });

    const raw = _ls['geochallenge:ux-telemetry-buffer'];
    const buffer = JSON.parse(raw);
    expect(buffer[0].name).toBe('mode_selected');
    expect(buffer[0].properties.destination).toBe('/game/single');
  });

  it('preserves events in buffer when flush fails', async () => {
    mockFetch.mockResolvedValue({ ok: false });

    for (let i = 0; i < 20; i++) {
      trackUxEvent('app_open');
    }

    await new Promise((r) => setTimeout(r, 100));

    const buffer = JSON.parse(_ls['geochallenge:ux-telemetry-buffer'] || '[]');
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe('getClientSessionId', () => {
  it('returns a valid session ID', () => {
    const sid = getClientSessionId();
    expect(sid).toBeDefined();
    expect(typeof sid).toBe('string');
    expect(sid.length).toBeGreaterThan(0);
  });
});
