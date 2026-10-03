// src/types/report.ts

import type { FloodItemMetadata, FloodState } from './flood';

/**
 * Community Report V2 — lifecycle vocabulary.
 *
 * A report's LIFECYCLE is distinct from its freshness. Freshness is a
 * time-decay presentation cue (see reportResolution.reportFreshness); lifecycle
 * is an explicit, user-driven state:
 *   - `ACTIVE`   — the reported flooding is believed ongoing. Contributes to
 *                  current risk (subject to the usual TTL decay).
 *   - `RESOLVED` — a user indicated the flooding has cleared. It remains
 *                  viewable as a historical community observation but NEVER
 *                  escalates current risk.
 *
 * Defaults are backward-compatible: a report with no `lifecycle` is treated as
 * `ACTIVE` everywhere.
 */
export type ReportLifecycle = 'ACTIVE' | 'RESOLVED';

/**
 * Structured water-level / severity choice collected by the report form. These
 * are commuter-facing severity buckets, mapped to the existing {@link FloodState}
 * for risk aggregation — they do NOT introduce a new risk level.
 */
export type ReportSeverity = 'MINOR' | 'MODERATE' | 'SEVERE' | 'UNSURE';

/** Structured water-depth choice collected by the report form. */
export type ReportDepth = 'ANKLE' | 'KNEE' | 'WAIST' | 'ABOVE_WAIST' | 'UNKNOWN';

/**
 * Structured passability choice collected by the report form. These four states
 * are preserved end-to-end and are NEVER collapsed into a single boolean for
 * display — `HIGH_CLEARANCE_ONLY` is a distinct, meaningful state (a vehicle may
 * pass only with high clearance), separate from fully `PASSABLE` and from
 * `NOT_PASSABLE`. A community `NOT_PASSABLE` is still only a community
 * observation and can never produce an official CONFIRMED_NOT_PASSABLE.
 */
export type ReportPassability =
  | 'PASSABLE'
  | 'HIGH_CLEARANCE_ONLY'
  | 'NOT_PASSABLE'
  | 'UNKNOWN';

/**
 * A Community Report (Req 14.1). V2 adds an OPTIONAL lifecycle block on top of
 * the original shape — every new field is optional so all existing fixtures and
 * tests remain valid without migration. A report with none of the V2 fields
 * behaves exactly as a V1 report: UNCONFIRMED, ACTIVE, zero confirmations.
 *
 * Non-verified community reports are always UNCONFIRMED (Req 14.3, 14.4) and can
 * at most escalate a barangay to REPORTED_FLOODING — never CONFIRMED_NOT_PASSABLE
 * (that is official-only). Community confirmations strengthen community evidence
 * but never create an official closure.
 */
export interface CommunityReport {
  id: string;
  state: FloodState;
  passable?: boolean;
  metadata: FloodItemMetadata; // dataType === 'COMMUNITY_REPORT'

  // ---- V2 lifecycle (all optional / backward-compatible) ----

  /** Structured severity from the report form, for display. */
  severity?: ReportSeverity;
  /** Structured water depth from the report form, for display. */
  depth?: ReportDepth;
  /** Structured passability from the report form, for display. */
  passability?: ReportPassability;

  /** Number of independent community confirmations. Defaults to 0. */
  confirmationCount?: number;
  /** Epoch seconds of the most recent confirmation, if any. */
  lastConfirmedAt?: number;
  /** Explicit lifecycle state. Absent → treated as `ACTIVE`. */
  lifecycle?: ReportLifecycle;
  /** Epoch seconds the report was marked RESOLVED, if it was. */
  resolvedAt?: number;
}

/** True when a report is RESOLVED (defaults to ACTIVE when the field is absent). */
export function isReportResolved(report: CommunityReport): boolean {
  return report.lifecycle === 'RESOLVED';
}

/** The effective lifecycle for a report (ACTIVE when unset). */
export function reportLifecycle(report: CommunityReport): ReportLifecycle {
  return report.lifecycle ?? 'ACTIVE';
}
