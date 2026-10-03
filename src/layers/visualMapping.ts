// src/layers/visualMapping.ts
//
// Pure susceptibility → visual mapping and FloodState → display-label logic.
//
// These are side-effect-free functions that translate flood data-model values
// into the reserved visual vocabulary (color token, non-color cue, display
// label, and rendering treatment). Rendering itself lives in the layer/UI code
// (Task 10); this module only decides *what* treatment a value maps to so the
// mapping can be property-tested in isolation.
//
// Colors are NOT defined here — they are imported from the canonical
// colorTokens module (Req 2.2, 13.1; design → "Susceptibility classification →
// visual mapping").

import { SUSCEPTIBILITY_COLORS, type ColorToken } from '../map/basemap/colorTokens';
import type { FloodDataType, FloodState, SusceptibilityLevel } from '../types/flood';

/**
 * The approved display vocabulary for each Flood_State (Req 13.4). These are the
 * ONLY strings a Flood_State may be labeled with. GRAY maps to "Unknown" and is
 * never relabeled "no risk", "safe", or "clear" (Req 13.1, 13.4, 12.7).
 */
const FLOOD_STATE_LABELS: Record<FloodState, string> = {
  RED: 'Reported Flooding',
  ORANGE: 'Elevated Flood Exposure',
  YELLOW: 'Caution',
  GREEN: 'Recently Reported Passable',
  GRAY: 'Unknown',
} as const;

/** Human-readable text label per susceptibility level (Req 11.4). */
const SUSCEPTIBILITY_LABELS: Record<SusceptibilityLevel, string> = {
  HIGH: 'High',
  MODERATE: 'Moderate',
  LOW: 'Low',
} as const;

/**
 * Non-color accessibility cue per susceptibility level (Req 11.4; design →
 * "Susceptibility classification → visual mapping"). Because color alone must
 * not convey status, each level also carries a hatch pattern + icon identifier
 * and a text label used in the legend and popup.
 */
export interface SusceptibilityCue {
  /** Machine identifier for the hatch/fill pattern (denser == higher). */
  readonly pattern: 'hatch-dense' | 'hatch-medium' | 'hatch-light';
  /** Machine identifier for the legend/popup icon. */
  readonly icon: string;
  /** Text label ("High" / "Moderate" / "Low"). */
  readonly label: string;
}

const SUSCEPTIBILITY_CUES: Record<SusceptibilityLevel, SusceptibilityCue> = {
  HIGH: { pattern: 'hatch-dense', icon: 'susceptibility-high', label: 'High' },
  MODERATE: {
    pattern: 'hatch-medium',
    icon: 'susceptibility-moderate',
    label: 'Moderate',
  },
  LOW: { pattern: 'hatch-light', icon: 'susceptibility-low', label: 'Low' },
} as const;

/**
 * The visual treatment a flood item is rendered with. A susceptibility area is
 * a translucent area-polygon fill; reports (official or community) are rendered
 * as symbols/segments. The two sets are disjoint (Req 12.2, 14.1; design →
 * Property 6).
 */
export type VisualTreatment = 'polygon-fill' | 'symbol';

/**
 * Maps a susceptibility level to its reserved translucent-friendly color token
 * by delegating to the canonical {@link SUSCEPTIBILITY_COLORS} palette — HIGH →
 * red, MODERATE → orange, LOW → yellow (Req 2.2, 13.1). Colors are never
 * redefined here.
 */
export function susceptibilityColor(level: SusceptibilityLevel): ColorToken {
  return SUSCEPTIBILITY_COLORS[level];
}

/**
 * Maps a Flood_State to its approved display label. The returned string is
 * always drawn from {@link FLOOD_STATE_LABELS}; GRAY maps to "Unknown" and no
 * label uses a "no risk"/"safe"/"clear" designation (Req 13.4, 13.1).
 */
export function floodStateLabel(state: FloodState): string {
  return FLOOD_STATE_LABELS[state];
}

/** Text label for a susceptibility level ("High"/"Moderate"/"Low") (Req 11.4). */
export function susceptibilityLabel(level: SusceptibilityLevel): string {
  return SUSCEPTIBILITY_LABELS[level];
}

/**
 * Non-color cue (hatch pattern + icon + text label) for a susceptibility level,
 * so status is perceivable without color (Req 11.4).
 */
export function susceptibilityPattern(level: SusceptibilityLevel): SusceptibilityCue {
  return SUSCEPTIBILITY_CUES[level];
}

/**
 * Classifies the rendering treatment for a flood item's data type. A
 * SUSCEPTIBILITY item is a translucent area-polygon fill; REPORT and
 * COMMUNITY_REPORT items are symbol/segment treatments. This encodes that the
 * susceptibility and report treatments are mutually exclusive (Req 12.2, 14.1;
 * design → Property 6).
 */
export function visualTreatment(dataType: FloodDataType): VisualTreatment {
  return dataType === 'SUSCEPTIBILITY' ? 'polygon-fill' : 'symbol';
}

/** Exposed for exhaustive testing of the approved label vocabulary. */
export { FLOOD_STATE_LABELS, SUSCEPTIBILITY_LABELS };
