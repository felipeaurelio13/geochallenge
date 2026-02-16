import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackendKeepAlive, KEEP_ALIVE_INTERVAL_MS } from '../components/BackendKeepAlive';
import { api } from '../services/api';

describe('BackendKeepAlive', () => {
  let isHidden = false;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(api, 'healthCheck').mockResolvedValue(true);

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => isHidden,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    isHidden = false;
  });

  it('pings backend on mount and at interval when tab is visible', () => {
    render(<BackendKeepAlive />);

    expect(api.healthCheck).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);
    expect(api.healthCheck).toHaveBeenCalledTimes(2);
  });

  it('skips interval ping when tab is hidden and resumes on visibility change', () => {
    render(<BackendKeepAlive />);

    expect(api.healthCheck).toHaveBeenCalledTimes(1);

    isHidden = true;
    vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);
    expect(api.healthCheck).toHaveBeenCalledTimes(1);

    isHidden = false;
    document.dispatchEvent(new Event('visibilitychange'));

    expect(api.healthCheck).toHaveBeenCalledTimes(2);
  });
});
