// src/components/controls/MapModeSwitcher.tsx
//
// A small segmented control that selects the ACTIVE map interaction mode:
//   Route     — trip planning (search + compare routes).
//   Community — tap-to-report an UNVERIFIED community flood report.
//   Historical— the DEMO / RESEARCH Historical Flood Evidence explorer.
//
// Only one mode is active at a time, so Route planning, Community reporting,
// and Historical evidence can no longer crowd the screen simultaneously. The
// switcher is purely presentational: it reports the chosen mode and never
// changes flood semantics. Historical is clearly tagged as a demo/research
// surface (not current conditions) via its own badge in the panel it opens.

export type MapMode = 'route' | 'community' | 'historical';

export interface MapModeSwitcherProps {
  value: MapMode;
  onChange: (mode: MapMode) => void;
  className?: string;
}

interface ModeDef {
  readonly id: MapMode;
  readonly label: string;
  readonly ariaLabel: string;
}

const MODES: readonly ModeDef[] = [
  { id: 'route', label: 'Route', ariaLabel: 'Route planning mode' },
  { id: 'community', label: 'Community', ariaLabel: 'Community report mode' },
  {
    id: 'historical',
    label: 'Historical',
    ariaLabel: 'Historical flood evidence mode (demo / research use only)',
  },
];

export function MapModeSwitcher({ value, onChange, className }: MapModeSwitcherProps) {
  return (
    <nav className="baharoute-map-navigation" aria-label="Map navigation">
      <a href="/" className="baharoute-mode-switcher__option baharoute-focus-ring">
        Home
      </a>
      <div
        className={['baharoute-mode-switcher', className].filter(Boolean).join(' ')}
        role="radiogroup"
        aria-label="Map mode"
        data-testid="map-mode-switcher"
      >
        {MODES.map((mode) => {
          const active = value === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={mode.ariaLabel}
              className="baharoute-mode-switcher__option baharoute-focus-ring"
              data-active={active ? 'true' : undefined}
              data-testid={`map-mode-${mode.id}`}
              onClick={() => onChange(mode.id)}
            >
              {mode.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MapModeSwitcher;
