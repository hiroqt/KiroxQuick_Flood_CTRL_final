// src/components/overlays/ErrorMessage.tsx
//
// An accessible "The map could not load" message used on tile failure or the
// 15s tile-load timeout (Req 1.6, 18.1; design → Components table: ErrorMessage,
// Error Handling table). Purely presentational and reusable: it accepts an
// optional reason and optional children so it can be reused for other failure
// contexts without changing its accessible role.

import type { ReactNode } from 'react';

export interface ErrorMessageProps {
  /**
   * Headline text. Defaults to a neutral map-load failure message. Kept free of
   * safety language (no "safe"/"clear"/"no risk").
   */
  message?: string;
  /**
   * Optional short reason/detail (e.g. "timeout"). Rendered below the headline
   * when provided.
   */
  reason?: string;
  /** Optional custom body; overrides `reason` when both are supplied. */
  children?: ReactNode;
  className?: string;
}

/**
 * Renders a `role="alert"` region so the failure is announced to assistive
 * technology. The app stays alive; this only communicates the failure.
 */
export function ErrorMessage({
  message = 'The map could not load',
  reason,
  children,
  className,
}: ErrorMessageProps = {}) {
  return (
    <section
      role="alert"
      className={['baharoute-error-message', className]
        .filter(Boolean)
        .join(' ')}
      data-testid="error-message"
    >
      <h2>{message}</h2>
      {children ?? (reason ? <p>{reason}</p> : null)}
    </section>
  );
}

export default ErrorMessage;
