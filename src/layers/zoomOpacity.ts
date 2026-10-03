// src/layers/zoomOpacity.ts

/**
 * Zoom-dependent visual dominance for flood-susceptibility polygons.
 *
 * Susceptibility regions dominate at Metro Manila overview zoom and recede at
 * street level so that road detail, route lines, and current/recent flood
 * reports take priority as the user zooms in. This is a pure, non-increasing
 * mapping from zoom level to `fill-opacity` (Req 2.1, 12.2; design → Flood Map
 * Visual Concept → Zoom-dependent visual dominance).
 *
 * The interpolation stops are the single source of truth used both by the pure
 * evaluator ({@link susceptibilityFillOpacity}) and by the Mapbox GL JS paint
 * expression builder ({@link susceptibilityFillOpacityExpression}).
 */

/** A single `[zoom, opacity]` interpolation stop. */
export interface OpacityStop {
  readonly zoom: number;
  readonly opacity: number;
}

/**
 * Zoom → susceptibility `fill-opacity` interpolation stops, in ascending zoom
 * order. Opacity is monotonically non-increasing: prominent at overview zoom
 * (~z10), strongly de-emphasized by street level (~z15–17).
 *
 * Single source of truth — consumed by both {@link susceptibilityFillOpacity}
 * and {@link susceptibilityFillOpacityExpression} (design → Zoom-dependent
 * visual dominance).
 */
export const SUSCEPTIBILITY_OPACITY_STOPS: readonly OpacityStop[] = [
  { zoom: 10, opacity: 0.45 }, // overview: prominent
  { zoom: 13, opacity: 0.3 },
  { zoom: 15, opacity: 0.12 }, // street level: strongly de-emphasized
  { zoom: 17, opacity: 0.06 },
] as const;

/**
 * Evaluates the susceptibility `fill-opacity` for a given map zoom using linear
 * interpolation across {@link SUSCEPTIBILITY_OPACITY_STOPS}.
 *
 * Behaviour:
 * - At or below the first stop's zoom → clamped to the first stop's opacity.
 * - At or above the last stop's zoom → clamped to the last stop's opacity.
 * - Between two stops → linearly interpolated.
 *
 * Because the stop opacities are non-increasing and clamping preserves the
 * bounds, the result is a non-increasing function of zoom: for any `z1 < z2`,
 * `susceptibilityFillOpacity(z1) >= susceptibilityFillOpacity(z2)`
 * (Property 8; Req 2.1, 12.2).
 *
 * @param zoom - The map zoom level (typically 0–22). `NaN` is treated as the
 *   lower clamp for safety and never throws.
 * @returns The interpolated fill-opacity in the `[minStopOpacity,
 *   maxStopOpacity]` range.
 */
export function susceptibilityFillOpacity(zoom: number): number {
  const stops = SUSCEPTIBILITY_OPACITY_STOPS;
  const first = stops[0];
  const last = stops[stops.length - 1];

  // Guard against NaN — clamp to the most-prominent (lowest-zoom) opacity.
  if (Number.isNaN(zoom) || zoom <= first.zoom) {
    return first.opacity;
  }
  if (zoom >= last.zoom) {
    return last.opacity;
  }

  // Find the bracketing stops and linearly interpolate between them.
  for (let i = 0; i < stops.length - 1; i += 1) {
    const lower = stops[i];
    const upper = stops[i + 1];
    if (zoom >= lower.zoom && zoom <= upper.zoom) {
      const span = upper.zoom - lower.zoom;
      const t = span === 0 ? 0 : (zoom - lower.zoom) / span;
      return lower.opacity + t * (upper.opacity - lower.opacity);
    }
  }

  // Unreachable given the clamps above, but keep a safe fallback.
  return last.opacity;
}

/**
 * A Mapbox GL JS `["interpolate", ["linear"], ["zoom"], ...]` expression as a
 * readonly tuple. Kept structurally typed (rather than importing Mapbox's
 * internal style-spec types) so it can be asserted directly in tests and
 * reused by the fill layer definition in Task 10.1.
 */
export type ZoomInterpolateExpression = readonly [
  'interpolate',
  readonly ['linear'],
  readonly ['zoom'],
  ...number[],
];

/**
 * Builds the Mapbox GL JS zoom-interpolated `fill-opacity` paint expression from the
 * same {@link SUSCEPTIBILITY_OPACITY_STOPS} the pure evaluator uses, guaranteeing
 * the rendered layer and the tested logic never drift apart (design →
 * Zoom-dependent visual dominance).
 *
 * @returns e.g. `["interpolate", ["linear"], ["zoom"], 10, 0.45, 13, 0.3, 15, 0.12, 17, 0.06]`.
 */
export function susceptibilityFillOpacityExpression(): ZoomInterpolateExpression {
  const flatStops = SUSCEPTIBILITY_OPACITY_STOPS.flatMap((stop) => [
    stop.zoom,
    stop.opacity,
  ]);
  return ['interpolate', ['linear'], ['zoom'], ...flatStops] as const;
}
