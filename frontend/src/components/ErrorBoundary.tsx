import React from 'react';
import i18n from 'i18next';
import { FullScreenError } from './molecules/FullScreenError';
import { trackUxEvent } from '../utils/uxTelemetry';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    try {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    } catch {
      // Logging must not interfere with the fallback UI.
    }

    try {
      trackUxEvent('ui_error', {
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
        componentStack: errorInfo.componentStack,
        buildSha: __BUILD_SHA__,
        pathname: typeof window === 'undefined' ? undefined : window.location.pathname,
      });
    } catch {
      // Telemetry is best-effort and must never cause a second error.
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <FullScreenError
          title={i18n.t('error.title')}
          message={i18n.t('error.unexpected')}
          onRetry={() => this.setState({ hasError: false, error: null })}
          retryLabel={i18n.t('error.retry')}
          backTo="/"
          backLabel={i18n.t('error.backToMenu')}
        />
      );
    }

    return this.props.children;
  }
}
