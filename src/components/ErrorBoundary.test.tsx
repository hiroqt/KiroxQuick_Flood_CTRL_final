// src/components/ErrorBoundary.test.tsx
//
// Verifies the error boundary renders a fallback message when a child throws
// during render, instead of crashing to a blank tree (design → Error Handling;
// Req 1.4).

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('render boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // The boundary logs the caught error via componentDidCatch; silence it so
    // the expected error does not clutter test output.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the default fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('renders a custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={(error) => <p>Caught: {error.message}</p>}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/caught: render boom/i)).toBeInTheDocument();
  });

  it('renders children unchanged when nothing throws', () => {
    render(
      <ErrorBoundary>
        <span>All good</span>
      </ErrorBoundary>,
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
  });
});
