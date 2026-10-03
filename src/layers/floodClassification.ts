// src/layers/floodClassification.ts
//
// Pure flood validation & classification logic.
//
// These are side-effect-free functions and form the primary property-based
// testing surface for the flood data model (design → "Validation &
// classification logic"). Times are epoch SECONDS.

import type {
  FloodItemMetadata,
  FloodReport,
  FloodState,
  GeoLocation,
} from '../types/flood';
import type { RecencyConfig } from '../types/config';

/** The complete, closed set of Flood_State values (Req 12.1, 13.4). */
const FLOOD_STATES: readonly FloodState[] = [
  'RED',
  'ORANGE',
  'YELLOW',
  'GREEN',
  'GRAY',
];

/**
 * Flood_State values that describe a current, in-window *reported* condition
 * and may be surfaced as-is by {@link classifyFloodState}. GREEN is handled
 * separately because it additionally requires present-and-recent passability;
 * GRAY is the fallback for absent/stale data.
 */
const REPORTED_CONDITION_STATES: ReadonlySet<FloodState> = new Set<FloodState>([
  'RED',
  'ORANGE',
  'YELLOW',
]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidLocation(location: unknown): location is GeoLocation {
  if (typeof location !== 'object' || location === null) {
    return false;
  }
  const { lng, lat } = location as Partial<GeoLocation>;
  return isFiniteNumber(lng) && isFiniteNumber(lat);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard: returns true iff all required Flood_Item_Metadata fields are
 * present with the correct types — `location` (numeric lng/lat), `source`,
 * `dataType`, `updatedAt`, and `verificationStatus`. Items missing any
 * required field are rejected so they are never projected (Req 12.3).
 *
 * Optional fields (severity, depth, description, sourceUrl) are not required
 * and are not validated here (Req 12.4).
 */
export function validateFloodMetadata(
  m: Partial<FloodItemMetadata>,
): m is FloodItemMetadata {
  if (typeof m !== 'object' || m === null) {
    return false;
  }
  return (
    isValidLocation(m.location) &&
    isNonEmptyString(m.source) &&
    isNonEmptyString(m.dataType) &&
    isFiniteNumber(m.updatedAt) &&
    isNonEmptyString(m.verificationStatus)
  );
}

/**
 * Classifies a location's Flood_State from a (possibly absent) report, the
 * current time, and the recency window. The returned value is always strictly
 * within `{RED, ORANGE, YELLOW, GREEN, GRAY}` (Req 12.1, 13.4).
 *
 * Rules (design → "Validation & classification logic"):
 * - GRAY when there is no report, or the report's metadata is invalid, or the
 *   report is stale (`now - updatedAt > windowSeconds`). GRAY means "Unknown"
 *   and is never treated as "no risk" (Req 12.7, 13.4).
 * - GREEN iff passability information is present (`passable === true`) AND the
 *   report is in-window (`now - updatedAt <= windowSeconds`, edge inclusive)
 *   (Req 12.6, 12.5).
 * - For an in-window report whose state is RED/ORANGE/YELLOW, that current
 *   reported condition is returned as-is.
 * - A report whose state is GREEN but which lacks present-and-recent
 *   passability is downgraded to GRAY rather than being surfaced as GREEN.
 *
 * @param now epoch seconds
 * @param recency recency window (seconds)
 */
export function classifyFloodState(
  report: FloodReport | undefined,
  now: number,
  recency: RecencyConfig,
): FloodState {
  // Absent report → GRAY (Unknown), never "no risk".
  if (report === undefined || report === null) {
    return 'GRAY';
  }

  // A report with invalid/missing required metadata cannot be trusted → GRAY.
  if (!validateFloodMetadata(report.metadata)) {
    return 'GRAY';
  }

  const age = now - report.metadata.updatedAt;
  const inWindow = age <= recency.windowSeconds; // edge inclusive (Req 12.6)

  // Stale information → GRAY (Unknown), never "no risk" (Req 12.7).
  if (!inWindow) {
    return 'GRAY';
  }

  // GREEN only when passability is present AND recent (Req 12.6).
  const passabilityPresentAndRecent = report.passable === true && inWindow;
  if (passabilityPresentAndRecent) {
    return 'GREEN';
  }

  // In-window reported condition: surface RED/ORANGE/YELLOW as-is.
  if (REPORTED_CONDITION_STATES.has(report.state)) {
    return report.state;
  }

  // report.state would be GREEN (or otherwise) but passability is not
  // present/recent → downgrade to GRAY rather than invent "no risk".
  return 'GRAY';
}

/** Exposed for exhaustive testing of the closed Flood_State set. */
export { FLOOD_STATES };
