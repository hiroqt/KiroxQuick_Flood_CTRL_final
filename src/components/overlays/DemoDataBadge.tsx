// src/components/overlays/DemoDataBadge.tsx
//
// A visible, accessible badge labeling on-screen content as demo/fixture data,
// so Fixture_Data is never mistaken for authoritative information (Req 15.2,
// 15.4; design → Components table: DemoDataBadge). Purely presentational; the
// parent decides when demo layers are present and renders this.

export interface DemoDataBadgeProps {
  /** Visible + accessible label. Defaults to "Demo data". */
  label?: string;
  className?: string;
}

/**
 * Renders a small badge with visible text (not color alone) identifying the
 * content as demonstration/fixture data. Uses an image role with an accessible
 * name so assistive technology announces it.
 */
export function DemoDataBadge({
  label = 'Demo data',
  className,
}: DemoDataBadgeProps = {}) {
  return (
    <span
      role="img"
      aria-label={label}
      className={['baharoute-demo-badge', className].filter(Boolean).join(' ')}
      data-testid="demo-data-badge"
    >
      {label}
    </span>
  );
}

export default DemoDataBadge;
