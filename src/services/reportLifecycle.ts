// src/services/reportLifecycle.ts
//
// Community Report V2 — Phase 1 lifecycle helpers (pure, deterministic).
//
// This module is a PRESENTATION + model-mapping layer on top of the existing
// freshness semantics (see reportResolution.reportFreshness). It does NOT change
// risk semantics: community reports still cap at REPORTED_FLOODING, and nothing
// here produces an official closure. It provides:
//   - mapping from the report form's structured choices → FloodState/passable
//     and human labels,
//   - a 5-stage presentation lifecycle (Fresh/Recent/Aging/Stale/Resolved) that
//     layers over the 3-bucket freshness without rewriting it,
//   - pure update helpers (confirm / update conditions / resolve) that return a
//     NEW report object (callers own the store).

import type { FloodState } from '../types/flood';
import type {
  CommunityReport,
  ReportDepth,
  ReportPassability,
  ReportSeverity,
} from '../types/report';
import {
  REPORT_TTL_SECONDS,
  REPORT_FRESH_SECONDS,
} from './reportResolution';

/**
 * The commuter-facing presentation lifecycle stage. Resolved is explicit;
 * Fresh/Recent/Aging/Stale are time-decay buckets derived from the report's
 * `updatedAt` (and `lastConfirmedAt` when newer). This is display-only and does
 * not alter the risk TTL in reportResolution.
 */
export type ReportLifecycleStage =
  | 'FRESH'
  | 'RECENT'
  | 'AGING'
  | 'STALE'
  | 'RESOLVED';

/** Boundary (seconds) between FRESH and RECENT. Half of the fresh window. */
export const REPORT_RECENT_SECONDS = Math.floor(REPORT_FRESH_SECONDS / 2);

/**
 * The effective "last activity" time for a report: the later of its `updatedAt`
 * and any `lastConfirmedAt` (a confirmation keeps a report current). Epoch sec.
 */
export function reportActivityAt(report: CommunityReport): number {
  const updated = report.metadata.updatedAt;
  const confirmed = report.lastConfirmedAt ?? 0;
  return Math.max(updated, confirmed);
}

/**
 * Derives the 5-stage presentation lifecycle for a report. RESOLVED wins
 * outright. Otherwise the age of the last activity is bucketed:
 *   age ≤ RECENT         → FRESH
 *   age ≤ FRESH window   → RECENT
 *   age ≤ TTL            → AGING
 *   age  > TTL           → STALE
 * Pure; `now` injectable.
 */
export function reportLifecycleStage(
  report: CommunityReport,
  now: number = Math.floor(Date.now() / 1000),
): ReportLifecycleStage {
  if (report.lifecycle === 'RESOLVED') return 'RESOLVED';
  const age = Math.max(0, now - reportActivityAt(report));
  if (age <= REPORT_RECENT_SECONDS) return 'FRESH';
  if (age <= REPORT_FRESH_SECONDS) return 'RECENT';
  if (age <= REPORT_TTL_SECONDS) return 'AGING';
  return 'STALE';
}

/** Short commuter-facing label for a lifecycle stage. */
export function reportLifecycleStageLabel(stage: ReportLifecycleStage): string {
  switch (stage) {
    case 'FRESH':
      return 'Fresh';
    case 'RECENT':
      return 'Recent';
    case 'AGING':
      return 'Aging';
    case 'STALE':
      return 'Stale';
    case 'RESOLVED':
      return 'Resolved';
  }
}

// ---------------------------------------------------------------------------
// Report-form choice mapping → FloodState / passable + human labels.
// ---------------------------------------------------------------------------

/**
 * DETERMINISTIC severity derivation from the OBSERVABLE report inputs (water
 * depth + passability). Severity is NOT asked of the user directly (that was
 * subjective and redundant with depth); it is derived here so the risk model
 * keeps a FloodState to work with. Documented mapping (worst of the two
 * signals wins):
 *
 *   depth ABOVE_WAIST                         → severe   (RED)
 *   depth WAIST                               → severe   (RED)
 *   depth KNEE                                → moderate (ORANGE)
 *   depth ANKLE                               → minor    (YELLOW)
 *   depth UNKNOWN                             → (fall through to passability)
 *   passability NOT_PASSABLE                  → severe   (RED)
 *   passability HIGH_CLEARANCE_ONLY           → moderate (ORANGE)
 *   passability PASSABLE                      → minor    (YELLOW)
 *   nothing observable (depth+pass UNKNOWN)   → unsure   (GRAY, excluded from risk)
 *
 * This never introduces a new risk level and never reaches a closure state —
 * the strongest community outcome remains REPORTED_FLOODING (via RED), gated by
 * the risk model. GRAY (unsure) is excluded from risk aggregation entirely, so
 * an unobservable report never inflates risk.
 */
export function deriveSeverity(
  depth: ReportDepth,
  passability: ReportPassability,
): ReportSeverity {
  const fromDepth: ReportSeverity | null =
    depth === 'ABOVE_WAIST' || depth === 'WAIST'
      ? 'SEVERE'
      : depth === 'KNEE'
        ? 'MODERATE'
        : depth === 'ANKLE'
          ? 'MINOR'
          : null; // UNKNOWN depth → no depth signal

  const fromPass: ReportSeverity | null =
    passability === 'NOT_PASSABLE'
      ? 'SEVERE'
      : passability === 'HIGH_CLEARANCE_ONLY'
        ? 'MODERATE'
        : passability === 'PASSABLE'
          ? 'MINOR'
          : null; // UNKNOWN passability → no passability signal

  const rank: Record<ReportSeverity, number> = { UNSURE: 0, MINOR: 1, MODERATE: 2, SEVERE: 3 };
  let worst: ReportSeverity = 'UNSURE';
  for (const s of [fromDepth, fromPass]) {
    if (s !== null && rank[s] > rank[worst]) worst = s;
  }
  return worst;
}

/**
 * Maps a severity to a {@link FloodState}. REUSES the five existing flood
 * states — no new level, never a closure state. `UNSURE` → GRAY (excluded from
 * risk). Severity is derived (see {@link deriveSeverity}), not user-entered.
 */
export function severityToFloodState(severity: ReportSeverity): FloodState {
  switch (severity) {
    case 'SEVERE':
      return 'RED';
    case 'MODERATE':
      return 'ORANGE';
    case 'MINOR':
      return 'YELLOW';
    case 'UNSURE':
    default:
      return 'GRAY';
  }
}

/**
 * Maps the structured passability to the OPTIONAL legacy boolean `passable`.
 * This boolean is a lossy convenience ONLY — the authoritative value is the
 * structured {@link ReportPassability} on the report, which preserves the
 * HIGH_CLEARANCE_ONLY distinction. Both HIGH_CLEARANCE_ONLY and NOT_PASSABLE
 * map to `false` here (not fully passable), but the UI reads the structured
 * field for display, so the distinction is never lost on screen. UNKNOWN leaves
 * it undefined (not asserted). A community NOT_PASSABLE never produces an
 * official closure.
 */
export function passabilityToPassable(
  passability: ReportPassability,
): boolean | undefined {
  switch (passability) {
    case 'PASSABLE':
      return true;
    case 'NOT_PASSABLE':
    case 'HIGH_CLEARANCE_ONLY':
      return false;
    case 'UNKNOWN':
    default:
      return undefined;
  }
}

/** Human label for a severity choice. */
export function severityLabel(severity: ReportSeverity): string {
  switch (severity) {
    case 'MINOR':
      return 'Minor flooding';
    case 'MODERATE':
      return 'Moderate flooding';
    case 'SEVERE':
      return 'Severe flooding';
    case 'UNSURE':
      return 'Severity unsure';
  }
}

/** Human label for a depth choice. */
export function depthLabel(depth: ReportDepth): string {
  switch (depth) {
    case 'ANKLE':
      return 'Ankle-deep';
    case 'KNEE':
      return 'Knee-deep';
    case 'WAIST':
      return 'Waist-deep';
    case 'ABOVE_WAIST':
      return 'Above waist';
    case 'UNKNOWN':
      return 'Depth unknown';
  }
}

/** Human label for a passability choice (HIGH_CLEARANCE_ONLY kept distinct). */
export function passabilityLabel(passability: ReportPassability): string {
  switch (passability) {
    case 'PASSABLE':
      return 'Passable';
    case 'HIGH_CLEARANCE_ONLY':
      return 'High-clearance vehicles only';
    case 'NOT_PASSABLE':
      return 'Not passable';
    case 'UNKNOWN':
      return 'Passability unknown';
  }
}

// ---------------------------------------------------------------------------
// Pure update helpers. Each returns a NEW CommunityReport (immutable update);
// the controller owns the actual store.
// ---------------------------------------------------------------------------

/**
 * The structured conditions collected by the report form / an update. Severity
 * is NOT collected here — it is derived deterministically from depth +
 * passability (see {@link deriveSeverity}), preferring observable inputs over a
 * subjective user classification.
 */
export interface ReportConditions {
  readonly depth: ReportDepth;
  readonly passability: ReportPassability;
  readonly note?: string;
}

/**
 * Applies a confirmation: increments `confirmationCount` and sets
 * `lastConfirmedAt`. NEVER changes verificationStatus, lifecycle, or risk
 * category — a confirmation is stronger COMMUNITY evidence only, never an
 * official closure.
 */
export function confirmReport(
  report: CommunityReport,
  now: number = Math.floor(Date.now() / 1000),
): CommunityReport {
  return {
    ...report,
    confirmationCount: (report.confirmationCount ?? 0) + 1,
    lastConfirmedAt: now,
  };
}

/**
 * Applies a "conditions changed" update: new severity/depth/passability/note,
 * refreshes `updatedAt`, and keeps the SAME report id (no duplicate). Re-maps
 * the derived `state`/`passable` from the structured choices. Stays UNCONFIRMED
 * and ACTIVE (an update does not clear the report).
 */
export function updateReportConditions(
  report: CommunityReport,
  conditions: ReportConditions,
  now: number = Math.floor(Date.now() / 1000),
): CommunityReport {
  const severity = deriveSeverity(conditions.depth, conditions.passability);
  return {
    ...report,
    state: severityToFloodState(severity),
    passable: passabilityToPassable(conditions.passability),
    severity,
    depth: conditions.depth,
    passability: conditions.passability,
    lifecycle: 'ACTIVE',
    metadata: {
      ...report.metadata,
      updatedAt: now,
      description:
        conditions.note && conditions.note.trim().length > 0
          ? conditions.note.trim()
          : report.metadata.description,
      severity: severityLabel(severity),
      depth: depthMeters(conditions.depth) ?? report.metadata.depth,
    },
  };
}

/**
 * Marks a report RESOLVED (flooding cleared). It keeps its id and remains
 * viewable as a historical community observation, but will no longer escalate
 * current risk (enforced in reportResolution aggregation).
 */
export function resolveReport(
  report: CommunityReport,
  now: number = Math.floor(Date.now() / 1000),
): CommunityReport {
  return {
    ...report,
    lifecycle: 'RESOLVED',
    resolvedAt: now,
    metadata: { ...report.metadata, updatedAt: now },
  };
}

/** A coarse numeric depth (meters) for the optional metadata.depth field. */
function depthMeters(depth: ReportDepth): number | undefined {
  switch (depth) {
    case 'ANKLE':
      return 0.15;
    case 'KNEE':
      return 0.5;
    case 'WAIST':
      return 1.0;
    case 'ABOVE_WAIST':
      return 1.5;
    case 'UNKNOWN':
    default:
      return undefined;
  }
}

/**
 * Builds a new COMMUNITY_REPORT from a map point + form conditions. Always
 * UNCONFIRMED and ACTIVE with zero confirmations. The caller supplies the id and
 * source label (so the demo/source labeling stays in one place).
 */
export function buildCommunityReport(
  id: string,
  lng: number,
  lat: number,
  conditions: ReportConditions,
  source: string,
  now: number = Math.floor(Date.now() / 1000),
): CommunityReport {
  const severity = deriveSeverity(conditions.depth, conditions.passability);
  return {
    id,
    state: severityToFloodState(severity),
    passable: passabilityToPassable(conditions.passability),
    severity,
    depth: conditions.depth,
    passability: conditions.passability,
    confirmationCount: 0,
    lifecycle: 'ACTIVE',
    metadata: {
      location: { lng, lat },
      source,
      dataType: 'COMMUNITY_REPORT',
      updatedAt: now,
      verificationStatus: 'UNCONFIRMED',
      severity: severityLabel(severity),
      depth: depthMeters(conditions.depth),
      description:
        conditions.note && conditions.note.trim().length > 0
          ? conditions.note.trim()
          : 'User-submitted community report of flooding. Unverified / not authoritative.',
    },
  };
}
