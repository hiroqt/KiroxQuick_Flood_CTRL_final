// src/types/historicalEvidence.ts
//
// HISTORICAL Flood Evidence model — DEMO / RESEARCH USE ONLY, NOT CURRENT
// CONDITIONS. This is a reference dataset of PAST flood observations (2009–2024)
// compiled from government reports + news archives (see
// docs/baharoute-historical-flood-evidence.md). It is intentionally kept
// SEPARATE from the live/current FloodEvidence model: historical evidence is
// context only and must NEVER alter current flood risk, rainfall, community
// reports, official closures, or route passability.

/**
 * Location precision as recorded in the research report. Drives how (and
 * whether) an item is placed on the map:
 *   - EXACT       → a specific road/segment/intersection → map to a known point.
 *   - HIGH        → barangay / known local area → barangay-level point.
 *   - APPROXIMATE → general area only → no precise point asserted.
 *   - CITY_ONLY   → city-level only → never assign a barangay/sub-location.
 *   - UNRESOLVED  → could not be resolved to geography.
 */
export type HistoricalLocationPrecision =
  | 'EXACT'
  | 'HIGH'
  | 'APPROXIMATE'
  | 'CITY_ONLY'
  | 'UNRESOLVED';

/** Passability as recorded in the report (no inference beyond the source). */
export type HistoricalPassability = 'PASSABLE' | 'IMPASSABLE' | 'UNKNOWN';

/**
 * One HISTORICAL flood-evidence item, transcribed verbatim from the research
 * dataset. Optional fields are absent/null when the source left them blank —
 * nothing is fabricated. `sourceUrl` is `null` when the report's cell was blank
 * ("Source link unavailable in research dataset" in the UI).
 */
export interface HistoricalFloodEvidence {
  readonly id: string;
  readonly title: string;
  readonly sourceName: string;
  /** `null` when the research report left the source_url cell blank. */
  readonly sourceUrl?: string | null;
  /** When the SOURCE was published (distinct from when the flood occurred). */
  readonly publicationDate?: string;
  /** When the flood EVENT occurred (distinct from publication date). */
  readonly eventDate?: string;
  readonly city?: string;
  readonly locationDetail?: string;
  readonly floodCondition?: string;
  readonly reportedDepth?: string;
  readonly passability?: HistoricalPassability;
  readonly locationPrecision: HistoricalLocationPrecision;
  /** The event grouping key (e.g. "ulysses-2020"), for the event/year filter. */
  readonly eventId: string;
  /** Human event label (e.g. "Typhoon Ulysses / Vamco — 2020"). */
  readonly eventLabel: string;
  /** The event year, for the year filter. */
  readonly eventYear: number;
  /**
   * Resolved map coordinate `[lng, lat]`, present ONLY for EXACT/HIGH items
   * that were matched to a known NCR point. ABSENT for APPROXIMATE / CITY_ONLY /
   * UNRESOLVED — we never fabricate coordinates when precision is insufficient.
   */
  readonly coordinates?: readonly [number, number];
  /** Always this constant — marks the item as historical web evidence. */
  readonly provenance: 'HISTORICAL_WEB_EVIDENCE';
}

/**
 * Whether an item's precision is high enough to justify a precise map point.
 * ONLY EXACT and HIGH qualify; APPROXIMATE/CITY_ONLY/UNRESOLVED must never get a
 * fabricated coordinate (they are surfaced in the list/city-flag only).
 */
export function precisionAllowsPoint(
  precision: HistoricalLocationPrecision,
): boolean {
  return precision === 'EXACT' || precision === 'HIGH';
}

/** Human label for a precision level. */
export function precisionLabel(p: HistoricalLocationPrecision): string {
  switch (p) {
    case 'EXACT':
      return 'Exact';
    case 'HIGH':
      return 'High';
    case 'APPROXIMATE':
      return 'Approximate';
    case 'CITY_ONLY':
      return 'City only';
    case 'UNRESOLVED':
      return 'Unresolved';
  }
}

/** Human label for a passability value. */
export function historicalPassabilityLabel(p: HistoricalPassability | undefined): string {
  switch (p) {
    case 'PASSABLE':
      return 'Passable';
    case 'IMPASSABLE':
      return 'Impassable';
    case 'UNKNOWN':
    default:
      return 'Unknown';
  }
}

/** Standard UI framing strings — reused everywhere so wording stays consistent. */
export const HISTORICAL_BADGE = 'HISTORICAL';
export const HISTORICAL_USE_LABEL = 'Demo / Research Use Only';
export const HISTORICAL_NOT_CURRENT_LABEL = 'Not Current Conditions';
export const HISTORICAL_RECORD_DISCLAIMER =
  'This does not represent current flood conditions.';
export const HISTORICAL_SOURCE_UNAVAILABLE =
  'Source link unavailable in research dataset';
