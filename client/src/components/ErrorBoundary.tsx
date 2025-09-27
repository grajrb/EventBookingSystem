import React from 'react';

interface ErrorBoundaryState { hasError: boolean; error?: any; }

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    if (window && (window as any).__APP_ERROR_METRICS__) {
      (window as any).__APP_ERROR_METRICS__.unhandledRender++;
    }
    // Could add remote logging here.
    // console.error('Unhandled render error', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <p className="text-slate-600 mb-6 max-w-md">An unexpected error occurred while rendering the page. You can try to continue or refresh the browser.</p>
          {this.state.error && (
            <details className="mb-4 max-w-lg w-full text-left text-xs bg-slate-100 p-3 rounded">
              <summary className="cursor-pointer mb-2">Error details</summary>
              <pre className="whitespace-pre-wrap break-words">{String(this.state.error?.stack || this.state.error)}</pre>
            </details>
          )}
          <div className="flex gap-3">
            <button onClick={this.handleReset} className="px-4 py-2 rounded bg-primary text-white">Try Again</button>
            <button onClick={() => window.location.reload()} className="px-4 py-2 rounded border">Reload Page</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
