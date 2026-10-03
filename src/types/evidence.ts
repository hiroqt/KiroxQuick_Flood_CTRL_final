// src/types/evidence.ts
//
// The AI Flood Evidence model + DETERMINISTIC confidence/corroboration rules.
//
// AI-discovered web evidence is a DISTINCT category (see provenance.ts /
// product constitution). It is explicitly UNOFFICIAL: a news or community
// signal — however corroborated — can NEVER become a CONFIRMED_CLOSURE. Only
// an authoritative/official source may do that, through the existing
// OfficialStatus path (src/data/fixtures/officialConfirmations.ts).
//
// Crucially, the LLM/AI never decides the final BahaRoute current-risk class.
// Evidence confidence here is assigned by PURE, deterministic rules so results
// are explainable and testable; the risk model is untouched.

import type { EvidenceProvenance } from './provenance';

/** The kind of flood-related event an article/report describes. */
export type FloodEventType =
  | 'FLOODING'
  | 'ROAD_FLOODED'
  | 'ROAD_CLOSED'
  | 'HEAVY_RAIN'
  | 'FLOOD_ADVISORY';

/** The provenance/kind of the underlying source. */
export type EvidenceSourceType = 'OFFICIAL' | 'NEWS' | 'COMMUNITY';

/**
 * Deterministic evidence confidence. NOTE: `OFFICIAL` here describes the
 * confidence of a piece of EVIDENCE from an official source — it does NOT, by
 * itself, create a CONFIRMED_CLOSURE. `CORROBORATED` ≠ CONFIRMED_CLOSURE.
 */
export type EvidenceConfidence = 'OFFICIAL' | 'CORROBORATED' | 'UNVERIFIED';

/** Whether the evidence is currently active or has aged out. */
export type EvidenceStatus = 'ACTIVE' | 'STALE';

/**
 * A single normalized piece of AI-discovered flood evidence. Coordinates and
 * barangay are OPTIONAL: when geocoding fails the evidence is kept but marked
 * location-unresolved and never assigned to a barangay (so it cannot affect
 * barangay risk).
 */
export interface FloodEvidence {
  readonly id: string;
  readonly eventType: FloodEventType;

  readonly locationText: string;
  readonly city?: string;
  readonly barangay?: string;
  /** Resolved barangay PSGC when geocoding succeeded and fell inside NCR. */
  readonly psgc?: string;
  /** `[lng, lat]` when geocoded; absent when location is unresolved. */
  readonly coordinates?: readonly [number, number];
  /** True when location text could not be resolved to an NCR coordinate. */
  readonly locationUnresolved: boolean;

  readonly summary: string;

  readonly sourceName: string;
  readonly sourceUrl: string;
  readonly sourceType: EvidenceSourceType;

  readonly confidence: EvidenceConfidence;

  /** ISO publication time, if known. */
  readonly publishedAt?: string;
  /** ISO observed/event time, if known. */
  readonly observedAt?: string;

  readonly status: EvidenceStatus;
  readonly isSynthetic: boolean;

  /** Unified provenance (always AI_WEB_EVIDENCE, or DEMO when synthetic). */
  readonly provenance: EvidenceProvenance;
}

/**
 * TTL for AI/news evidence (seconds). After this window an ACTIVE item becomes
 * STALE. STALE evidence is a data-quality state — it must NEVER be treated as
 * LOW risk or silently dropped from provenance.
 */
export const EVIDENCE_TTL_SECONDS = 4 * 60 * 60; // 4 hours

/**
 * TTL for OFFICIAL-sourced evidence (seconds), slightly longer per spec: 6h
 * unless superseded. Still only a freshness cue — not a closure.
 */
export const OFFICIAL_EVIDENCE_TTL_SECONDS = 6 * 60 * 60; // 6 hours

/**
 * Classifies evidence freshness from a publication/observation time against the
 * applicable TTL. Pure and deterministic; `now` injectable. A STALE result is a
 * data-quality signal only.
 */
export function evidenceStatusFor(
  sourceType: EvidenceSourceType,
  publishedAtMs: number | null,
  now: number = Date.now(),
): EvidenceStatus {
  if (publishedAtMs === null || !Number.isFinite(publishedAtMs)) {
    // No timestamp → treat as STALE (data-quality unknown), never ACTIVE-fresh.
    return 'STALE';
  }
  const ttlMs =
    (sourceType === 'OFFICIAL'
      ? OFFICIAL_EVIDENCE_TTL_SECONDS
      : EVIDENCE_TTL_SECONDS) * 1000;
  const age = Math.max(0, now - publishedAtMs);
  return age <= ttlMs ? 'ACTIVE' : 'STALE';
}

/**
 * A minimal view of one raw evidence signal used by the corroboration rule.
 * Two signals "corroborate" when they come from INDEPENDENT sources and refer
 * to the same area within a close time window.
 */
export interface CorroborationSignal {
  /** Distinct source identity (domain/outlet). Independence is by this key. */
  readonly sourceKey: string;
  readonly sourceType: EvidenceSourceType;
  /** Resolved barangay PSGC or a coarse area key; null when unresolved. */
  readonly areaKey: string | null;
  /** Publication time (epoch ms) or null. */
  readonly publishedAtMs: number | null;
}

/** Max time gap (ms) within which two signals count as the "same" event. */
export const CORROBORATION_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Assigns a deterministic confidence to a target signal given all signals in
 * the batch. Rules (per spec):
 *   - any OFFICIAL source                         → OFFICIAL
 *   - two INDEPENDENT sources, same area & window → CORROBORATED
 *   - a single NEWS source                        → UNVERIFIED
 *   - a single COMMUNITY source                   → UNVERIFIED
 *
 * Independence is by distinct `sourceKey`. An unresolved area (null areaKey)
 * can NOT corroborate (we cannot assert "same area"). CORROBORATED is NOT a
 * confirmed closure — that distinction is enforced by callers never wiring
 * evidence into the OfficialStatus provider.
 */
export function assignEvidenceConfidence(
  target: CorroborationSignal,
  all: readonly CorroborationSignal[],
): EvidenceConfidence {
  if (target.sourceType === 'OFFICIAL') return 'OFFICIAL';

  // Corroboration needs a known area to compare.
  if (target.areaKey !== null) {
    for (const other of all) {
      if (other === target) continue;
      if (other.sourceKey === target.sourceKey) continue; // not independent
      if (other.areaKey !== target.areaKey) continue; // different area
      // An OFFICIAL corroborator would already make the whole area official via
      // its own OFFICIAL confidence; here we require the time window to match.
      if (!withinWindow(target.publishedAtMs, other.publishedAtMs)) continue;
      return 'CORROBORATED';
    }
  }
  return 'UNVERIFIED';
}

/**
 * True when two publication times are within {@link CORROBORATION_WINDOW_MS}.
 * When EITHER timestamp is missing we conservatively treat them as NOT within
 * the window (we cannot assert "same time"), so a missing time never upgrades
 * confidence to CORROBORATED.
 */
export function withinWindow(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= CORROBORATION_WINDOW_MS;
}

/**
 * Hard invariant used across the codebase and tests: AI/news/community evidence
 * — at ANY confidence, including CORROBORATED — can never, on its own, be an
 * official confirmed closure. Returns true ONLY for genuinely official-sourced
 * evidence, and even then this is NOT sufficient to set CONFIRMED_NOT_PASSABLE
 * (that still requires the OfficialStatus provider with a valid closure record).
 */
export function evidenceCanContributeToClosure(e: FloodEvidence): boolean {
  return e.sourceType === 'OFFICIAL' && e.confidence === 'OFFICIAL';
}
