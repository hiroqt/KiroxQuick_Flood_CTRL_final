// src/components/ErrorBoundary.tsx
//
// A React error boundary that wraps the map subtree so an unexpected render
// error shows an accessible message rather than a blank crash (design → Error
// Handling: "A React error boundary wraps the map subtree so an unexpected
// render error shows a message rather than a blank crash"; Req 1.4).

import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Optional custom fallback. When omitted, a default accessible message is
   * rendered. Receives the caught error for context.
   */
  fallback?: (error: Error) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render errors in its subtree and renders a fallback message instead
 * of unmounting the whole app to a blank screen.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the error for diagnostics without crashing the app.
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback(error);
      }
      return (
        <div role="alert" className="baharoute-error-boundary">
          <h2>Something went wrong</h2>
          <p>
            The map ran into an unexpected problem and could not be displayed.
            Please reload the page to try again.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
