// Top-level error boundary. Catches render-time exceptions so the whole app
// doesn't blank out on a single component crash. Per
// `frontend-standards.mdc`: an error state must be a clear, actionable
// message — never a raw stack trace — for the user-facing copy.

import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Override the default fallback UI. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the full error in the console for debugging; keep the visible
    // message generic. `console.error` is allow-listed by the lint config.
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return <DefaultFallback error={this.state.error} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ error, onReset }: { error: Error; onReset: () => void }): ReactNode {
  return (
    <div
      role="alert"
      className="mx-auto mt-16 max-w-xl rounded border border-red-200 bg-red-50 p-6"
    >
      <h1 className="text-lg font-semibold text-red-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-red-800">
        The dashboard hit an unexpected error. You can try again, or reload the page.
      </p>
      <p className="mt-4 break-words font-mono text-xs text-red-700">{error.message}</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-4 rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
      >
        Try again
      </button>
    </div>
  );
}
