// src/components/overlays/LoadingIndicator.tsx
//
// A visible, accessible loading indicator shown WHILE base-map tiles load and
// dismissed by the parent (MapView) once the map has rendered (Req 1.5; design
// → Components table: LoadingIndicator). Purely presentational — it holds no
// map dependency and does not decide when to show/hide; the parent conditionally
// renders it.

export interface LoadingIndicatorProps {
  /**
   * Accessible + visible text. Defaults to "Loading map…". Keep it short; it is
   * announced to assistive technology via role="status".
   */
  label?: string;
  className?: string;
}

/**
 * Renders a `role="status"` region with visible text so both sighted and
 * assistive-technology users perceive that the map is loading. Status is
 * conveyed by text (not color alone) per Req 11.4.
 */
export function LoadingIndicator({
  label = 'Loading map…',
  className,
}: LoadingIndicatorProps = {}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={['baharoute-loading', className].filter(Boolean).join(' ')}
      data-testid="loading-indicator"
    >
      {/* Non-color cue: an animated spinner glyph plus text. */}
      <span className="baharoute-loading__spinner" aria-hidden="true" />
      <span className="baharoute-loading__text">{label}</span>
    </div>
  );
}

export default LoadingIndicator;
