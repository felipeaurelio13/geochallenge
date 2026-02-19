import React from 'react';

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
        <div className="h-full min-h-0 bg-gray-900 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">:(</div>
            <h2 className="text-2xl font-bold text-white mb-2">Algo salio mal</h2>
            <p className="text-gray-400 mb-6">Ha ocurrido un error inesperado</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
              >
                Intentar de nuevo
              </button>
              <a
                href="/menu"
                className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors inline-block"
              >
                Volver al menu
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
