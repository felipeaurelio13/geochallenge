import React from 'react';
import i18n from 'i18next';
import { FullScreenError } from './molecules/FullScreenError';

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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <FullScreenError
          emoji="😢"
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
