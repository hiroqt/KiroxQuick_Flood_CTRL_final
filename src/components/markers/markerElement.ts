// src/components/markers/markerElement.ts
//
// Builds the DOM element handed to a MapLibre HTML `Marker` overlay for the
// Origin_Marker / Destination_Marker (design → Components table: OriginMarker /
// DestinationMarker; "Map layer ordering" keeps UI markers topmost as DOM
// overlays so they carry accessible labels/focus).
//
// The two roles MUST be distinguishable WITHOUT relying on color — they differ
// by SHAPE / ICON (Req 8.2, 8.3) — and each element carries an accessible text
// label identifying its role (Req 8.5, 11.3). This helper is exported on its
// own so tests can assert the shape/icon difference and the accessible label
// independently of any map.

/** The two distinct marker roles supported at a time (Req 8.1). */
export type MarkerRole = 'origin' | 'destination';

/** Per-role presentation: distinct shape/icon (never color alone) + label. */
interface MarkerRolePresentation {
  /** Distinct glyph/icon so the roles differ by shape, not color (Req 8.2, 8.3). */
  readonly glyph: string;
  /** Data attribute value used as a non-color, machine-checkable shape cue. */
  readonly shape: string;
  /** Accessible role label identifying the marker (Req 8.5). */
  readonly label: string;
  /** A muted color applied in addition to (never instead of) the shape cue. */
  readonly color: string;
}

/**
 * Distinct presentation per role. Origin is a filled circle ("start" dot),
 * destination is a pin/teardrop ("end" pin) — clearly different shapes/icons so
 * the two are distinguishable without color (Req 8.2, 8.3). Colors are provided
 * as an additional, redundant cue only.
 */
const ROLE_PRESENTATION: Record<MarkerRole, MarkerRolePresentation> = {
  origin: {
    glyph: '●',
    shape: 'circle',
    label: 'Origin',
    color: '#2f6f4f',
  },
  destination: {
    glyph: '📍',
    shape: 'pin',
    label: 'Destination',
    color: '#6f2f4f',
  },
};

/** Accessible role label for a marker role (Req 8.5). */
export function markerRoleLabel(role: MarkerRole): string {
  return ROLE_PRESENTATION[role].label;
}

/**
 * Builds a jsdom-friendly DOM element for a marker role. The element:
 *   - carries `role="img"` and an `aria-label` naming its role (Req 8.5, 11.3),
 *   - encodes a non-color shape cue in `data-marker-shape` and a role in
 *     `data-marker-role` (Req 8.2, 8.3 — distinguishable without color),
 *   - includes a distinct visible glyph/icon plus a visually-hidden text label
 *     so the role is perceivable without color or icon fonts (Req 11.4).
 *
 * @param role - 'origin' or 'destination'.
 * @param doc - Document to create the element in (defaults to the global
 *   `document`); injectable for testing / SSR safety.
 */
export function createMarkerElement(
  role: MarkerRole,
  doc: Document = document,
): HTMLElement {
  const presentation = ROLE_PRESENTATION[role];

  const el = doc.createElement('div');
  el.className = `baharoute-marker baharoute-marker--${role}`;
  el.dataset.markerRole = role;
  // Non-color cue: the shape differs between roles regardless of color (Req 8.2, 8.3).
  el.dataset.markerShape = presentation.shape;
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', presentation.label);
  // The DOM node is focusable so keyboard users can reach the marker (Req 11.1).
  el.tabIndex = 0;
  el.style.color = presentation.color;

  // Distinct visible glyph/icon (shape cue), hidden from AT since the element
  // itself carries the aria-label.
  const glyph = doc.createElement('span');
  glyph.className = 'baharoute-marker__glyph';
  glyph.setAttribute('aria-hidden', 'true');
  glyph.textContent = presentation.glyph;
  el.appendChild(glyph);

  // Visually-hidden text label ensures the role is perceivable without color
  // or an icon font (Req 11.4). Kept in the DOM for tests to assert on.
  const text = doc.createElement('span');
  text.className = 'baharoute-marker__label';
  text.textContent = presentation.label;
  el.appendChild(text);

  return el;
}
