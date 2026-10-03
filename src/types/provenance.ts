// src/types/provenance.ts
//
// A unified, lightweight PROVENANCE model attached to any piece of flood
// evidence surfaced on the map or in a card. Its single job is TRANSPARENCY:
// a user must always be able to tell whether a datum is live, user-reported,
// AI-discovered web evidence, official, historical, or demo/synthetic. These
// categories are deliberately NOT merged (see .kiro/steering product
// constitution: "Do not blur these categories").
//
// This module is pure types + tiny pure helpers (labels). It introduces NO new
// risk semantics and never changes how a flood-risk class is computed.

/**
 * The origin of a piece of flood evidence. Each value is a DISTINCT category
 * that is surfaced separately — they are never conflated:
 *   - `LIVE_RAINFALL`    — near-real-time rainfall estimate (Open-Meteo model).
 *   - `COMMUNITY_REPORT` — a user-submitted, UNVERIFIED observation.
 *   - `AI_WEB_EVIDENCE`  — AI-discovered web/news evidence (e.g. via GDELT).
 *   - `OFFICIAL`         — official/authorized confirmation (the only closure path).
 *   - `HISTORICAL`       — reference/modelled susceptibility (Project NOAH / Phil-LiDAR).
 *   - `DEMO`             — synthetic/fixture data for guaranteed demo scenarios.
 */
export type DataOrigin =
  | 'LIVE_RAINFALL'
  | 'COMMUNITY_REPORT'
  | 'AI_WEB_EVIDENCE'
  | 'OFFICIAL'
  | 'HISTORICAL'
  | 'DEMO';

/**
 * Display metadata describing WHERE a datum came from and HOW current it is.
 * Minimal by design. `isSynthetic` is the hard switch the UI uses to render a
 * DEMO badge — any item with `isSynthetic: true` MUST be visibly labeled and
 * MUST never be counted as live/authoritative data.
 */
export interface EvidenceProvenance {
  /** The origin category. */
  readonly origin: DataOrigin;
  /** Short, human-facing label (e.g. "Live rainfall", "Community report"). */
  readonly label: string;
  /** Optional source/publisher name (e.g. "GMA News", "MMDA"). */
  readonly sourceName?: string;
  /** Optional link to the original source. */
  readonly sourceUrl?: string;
  /** Optional epoch-ms/ISO time the event was observed. */
  readonly observedAt?: string;
  /** Optional ISO time the source published. */
  readonly publishedAt?: string;
  /** Optional ISO time this datum was last refreshed. */
  readonly updatedAt?: string;
  /** True when the datum is synthetic/demo and must be visibly labeled. */
  readonly isSynthetic: boolean;
}

/** The default human label for each origin (used when none is supplied). */
export const DATA_ORIGIN_LABEL: Record<DataOrigin, string> = {
  LIVE_RAINFALL: 'Live rainfall',
  COMMUNITY_REPORT: 'Community report',
  AI_WEB_EVIDENCE: 'Web evidence',
  OFFICIAL: 'Official',
  HISTORICAL: 'Historical susceptibility',
  DEMO: 'Demo',
};

/**
 * A short transparency qualifier for each origin, suitable for a secondary line
 * under the label. Never implies safety or official status where there is none.
 */
export const DATA_ORIGIN_QUALIFIER: Record<DataOrigin, string> = {
  LIVE_RAINFALL: 'Near-real-time · model-based',
  COMMUNITY_REPORT: 'Unverified',
  AI_WEB_EVIDENCE: 'AI-discovered · unofficial',
  OFFICIAL: 'Authorized confirmation',
  HISTORICAL: 'Reference only',
  DEMO: 'Synthetic scenario',
};

/**
 * Builds a provenance record for an origin, applying sensible default labels.
 * `isSynthetic` defaults to `true` ONLY for the `DEMO` origin; every other
 * origin defaults to live/real unless the caller explicitly marks it synthetic
 * (e.g. a demo community report keeps its COMMUNITY_REPORT origin but is flagged
 * synthetic so it is still badged).
 */
export function makeProvenance(
  origin: DataOrigin,
  extra: Partial<Omit<EvidenceProvenance, 'origin'>> = {},
): EvidenceProvenance {
  const isSynthetic = extra.isSynthetic ?? origin === 'DEMO';
  return {
    origin,
    label: extra.label ?? DATA_ORIGIN_LABEL[origin],
    sourceName: extra.sourceName,
    sourceUrl: extra.sourceUrl,
    observedAt: extra.observedAt,
    publishedAt: extra.publishedAt,
    updatedAt: extra.updatedAt,
    isSynthetic,
  };
}

/** True when a provenance record must be visibly badged as demo/synthetic. */
export function isSyntheticProvenance(p: EvidenceProvenance): boolean {
  return p.isSynthetic === true;
}
