// src/components/overlays/Disclaimer.tsx
//
// An accessible disclaimer that MUST accompany any presented flood information
// (Req 13.3). It states that flood information supports the user's own
// decisions and is NOT a safety guarantee, keeping the user as the decision
// maker (Req 13.1, 13.2). By design it MUST NOT contain the banned safety
// vocabulary — "safe", "clear", "no risk" — nor a numeric safety score.
//
// Purely presentational; no map dependency. An optional variant lets flood
// popups add the historical-exposure framing (susceptibility indicates
// historical/modeled exposure and does not confirm current flooding, Req 13.3).

export type DisclaimerVariant = 'general' | 'susceptibility';

export interface DisclaimerProps {
  /**
   * "general" (default): decision-support / not-a-guarantee framing for any
   * flood information. "susceptibility": additionally frames susceptibility as
   * historical/modeled exposure that does not confirm current flooding.
   */
  variant?: DisclaimerVariant;
  className?: string;
}

const GENERAL_TEXT =
  'Flood information is provided to support your own travel decisions and is not a guarantee. You remain the decision maker.';

const SUSCEPTIBILITY_TEXT =
  'Susceptibility indicates historical or modeled flood exposure and does not confirm current flooding. This information supports your own decisions and is not a guarantee.';

/**
 * Renders a `role="note"` region (a supplementary aside) carrying the
 * decision-support disclaimer. Text-only framing so meaning is not conveyed by
 * color (Req 11.4).
 */
export function Disclaimer({
  variant = 'general',
  className,
}: DisclaimerProps = {}) {
  const text = variant === 'susceptibility' ? SUSCEPTIBILITY_TEXT : GENERAL_TEXT;
  return (
    <p
      role="note"
      className={['baharoute-disclaimer', className].filter(Boolean).join(' ')}
      data-testid="disclaimer"
    >
      {text}
    </p>
  );
}

export default Disclaimer;
