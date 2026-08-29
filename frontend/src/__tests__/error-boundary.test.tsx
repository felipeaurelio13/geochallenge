import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const telemetry = vi.hoisted(() => ({
  trackUxEvent: vi.fn(),
}));

vi.mock('../utils/uxTelemetry', () => telemetry);

vi.mock('../components/molecules/FullScreenError', () => ({
  FullScreenError: () => <div role="alert">fallback</div>,
}));

import { ErrorBoundary } from '../components/ErrorBoundary';

function ThrowingChild(): never {
  throw new Error('MAP chunk failed to load');
}

describe('ErrorBoundary telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, '__BUILD_SHA__', {
      value: 'test-build-sha',
      writable: true,
      configurable: true,
    });
    window.history.pushState({}, '', '/game/single');
  });

  it('records a ui_error with diagnostic properties and keeps the fallback visible', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(
        <ErrorBoundary>
          <ThrowingChild />
        </ErrorBoundary>
      );

      expect(screen.getByRole('alert')).toHaveTextContent('fallback');
      expect(telemetry.trackUxEvent).toHaveBeenCalledWith(
        'ui_error',
        expect.objectContaining({
          errorName: 'Error',
          errorMessage: 'MAP chunk failed to load',
          errorStack: expect.any(String),
          componentStack: expect.any(String),
          buildSha: 'test-build-sha',
          pathname: '/game/single',
        })
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('keeps the fallback visible when telemetry throws', () => {
    telemetry.trackUxEvent.mockImplementationOnce(() => {
      throw new Error('telemetry unavailable');
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(
        <ErrorBoundary>
          <ThrowingChild />
        </ErrorBoundary>
      );

      expect(screen.getByRole('alert')).toHaveTextContent('fallback');
    } finally {
      consoleError.mockRestore();
    }
  });
});
