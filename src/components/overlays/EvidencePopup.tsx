// src/components/overlays/EvidencePopup.tsx
//
// Popup shown when an AI Flood Evidence marker is clicked. AI-discovered web
// evidence is UNOFFICIAL by construction: this popup never presents it as an
// official confirmation or a confirmed closure, and never calls anything
// "safe". Synthetic/demo evidence carries a DEMO badge.

import { formatRelativeTime } from '../../layers/riskLabels';
import { AI_EVIDENCE_COLOR } from '../../layers/aiFloodEvidenceLayer';
import { DemoDataBadge } from './DemoDataBadge';
import { Disclaimer } from './Disclaimer';

export interface EvidencePopupProps {
  /** Event type key, e.g. "ROAD_FLOODED". */
  eventType: string;
  /** Deterministic confidence: UNVERIFIED | CORROBORATED | OFFICIAL. */
  confidence: string;
  /** ACTIVE | STALE. */
  status: string;
  /** True for demo/synthetic evidence. */
  synthetic: boolean;
  /** Publisher/source name. */
  sourceName: string;
  /** Link to the original source. */
  sourceUrl: string;
  /** Short summary/headline. */
  summary: string;
  /** Resolved city label (may be empty). */
  city?: string;
  /** Resolved barangay label (may be empty). */
  barangay?: string;
  /** ISO publication time (may be empty). */
  publishedAt?: string;
  className?: string;
}

/** Human label for an evidence event type. */
function eventTypeLabel(eventType: string): string {
  switch (eventType) {
    case 'ROAD_CLOSED':
      return 'Road closed (reported)';
    case 'ROAD_FLOODED':
      return 'Road flooded (reported)';
    case 'FLOOD_ADVISORY':
      return 'Flood advisory';
    case 'HEAVY_RAIN':
      return 'Heavy rain';
    case 'FLOODING':
    default:
      return 'Flooding (reported)';
  }
}

/** Human label for the evidence confidence (never implies a closure/safe). */
function confidenceLabel(confidence: string): string {
  switch (confidence) {
    case 'OFFICIAL':
      return 'OFFICIAL';
    case 'CORROBORATED':
      return 'CORROBORATED';
    case 'UNVERIFIED':
    default:
      return 'UNVERIFIED';
  }
}

/** Converts an ISO string to relative time (reuses the shared formatter). */
function relativeFromIso(iso: string | undefined): string {
  if (!iso) return 'Unknown';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 'Unknown';
  return formatRelativeTime(Math.floor(ms / 1000));
}

export function EvidencePopup({
  eventType,
  confidence,
  status,
  synthetic,
  sourceName,
  sourceUrl,
  summary,
  city,
  barangay,
  publishedAt,
  className,
}: EvidencePopupProps) {
  const location = [barangay, city].filter((s) => s && s.trim().length > 0).join(', ');

  return (
    <section
      className={['baharoute-evidence-popup', className].filter(Boolean).join(' ')}
      aria-label="Recent flood evidence"
      data-testid="evidence-popup"
    >
      <p className="baharoute-flood-popup__chip">
        <span
          aria-hidden="true"
          className="baharoute-flood-popup__swatch"
          style={{ backgroundColor: AI_EVIDENCE_COLOR }}
        />
        Recent Flood Evidence
        {synthetic && <DemoDataBadge label="DEMO" className="baharoute-demo-badge--inline" />}
      </p>

      {location && (
        <p className="baharoute-evidence-popup__location" data-testid="evidence-location">
          {location}
        </p>
      )}
      <p className="baharoute-evidence-popup__event" data-testid="evidence-event">
        {eventTypeLabel(eventType)}
      </p>

      <dl className="baharoute-flood-popup__fields">
        <dt>Source</dt>
        <dd data-testid="evidence-source">{sourceName || 'Unknown source'}</dd>

        <dt>Published</dt>
        <dd data-testid="evidence-published">{relativeFromIso(publishedAt)}</dd>

        <dt>Status</dt>
        <dd data-testid="evidence-confidence">
          {confidenceLabel(confidence)}
          {status === 'STALE' ? ' · stale' : ''}
        </dd>
      </dl>

      {summary && (
        <p className="baharoute-evidence-popup__summary" data-testid="evidence-summary-text">
          {summary}
        </p>
      )}

      {sourceUrl && (
        <a
          className="baharoute-evidence-popup__link baharoute-focus-ring"
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="evidence-view-source"
        >
          View source
        </a>
      )}

      <Disclaimer variant="general" />
    </section>
  );
}

export default EvidencePopup;
