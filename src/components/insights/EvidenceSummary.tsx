// src/components/insights/EvidenceSummary.tsx
//
// The unified "Flood Evidence" summary for a selected barangay or route. It
// presents each evidence CATEGORY side by side WITHOUT merging them (product
// constitution): Live Rainfall, Community Reports (unverified), Web Evidence
// (AI-discovered, unofficial), and Historical Susceptibility (reference only).
// When Demo Mode is active, a clearly-labeled Demo row is shown with the
// existing DemoDataBadge. Each category keeps its own provenance qualifier so a
// user always knows what they are looking at.
//
// Purely presentational: the parent assembles the already-separate values. This
// component invents no risk class and never calls anything "safe".

import {
  DATA_ORIGIN_QUALIFIER,
  type DataOrigin,
} from '../../types/provenance';
import type { EvidenceConfidence } from '../../types/evidence';
import { DemoDataBadge } from '../overlays/DemoDataBadge';

/** The Live Rainfall summary line (near-real-time, model-based). */
export interface RainfallSummary {
  /** Human rainfall value, e.g. "18.4 mm/hr", or null when unavailable/stale. */
  readonly valueText: string | null;
  /** Relative freshness, e.g. "Updated 3 min ago". */
  readonly updatedText: string;
  /** True when data is unavailable/stale (shown instead of a value). */
  readonly unavailable: boolean;
}

/** The Community Reports summary line (unverified). */
export interface CommunitySummary {
  readonly count: number;
}

/** The Web Evidence summary line (AI-discovered, unofficial). */
export interface WebEvidenceSummary {
  /** Count of ACTIVE evidence items resolving here. */
  readonly count: number;
  /** Strongest confidence among them, or null when none. */
  readonly strongestConfidence: EvidenceConfidence | null;
  /** True when the discovery agent is unavailable. */
  readonly agentUnavailable: boolean;
}

/** The Historical Susceptibility summary line (reference only). */
export interface HistoricalSummary {
  /** Class label, e.g. "High", or null when uncovered/unknown. */
  readonly classLabel: string | null;
}

/** A single demo item line (shown only in Demo Mode). */
export interface DemoSummaryItem {
  readonly label: string;
  readonly detail: string;
}

export interface EvidenceSummaryProps {
  rainfall: RainfallSummary;
  community: CommunitySummary;
  web: WebEvidenceSummary;
  historical: HistoricalSummary;
  /** Demo items; rendered ONLY when demoMode is true. */
  demoMode: boolean;
  demoItems?: readonly DemoSummaryItem[];
  className?: string;
}

/** Short human label for an evidence confidence. */
function confidenceText(c: EvidenceConfidence): string {
  switch (c) {
    case 'OFFICIAL':
      return 'Official source';
    case 'CORROBORATED':
      return 'Corroborated';
    case 'UNVERIFIED':
    default:
      return 'Unverified';
  }
}

/** One category block: label + value + a provenance qualifier line. */
function Category({
  origin,
  label,
  value,
  qualifier,
  testId,
}: {
  origin: DataOrigin;
  label: string;
  value: string;
  qualifier?: string;
  testId: string;
}) {
  return (
    <div className="baharoute-evidence__item" data-origin={origin} data-testid={testId}>
      <p className="baharoute-evidence__label">{label}</p>
      <p className="baharoute-evidence__value">{value}</p>
      <p className="baharoute-evidence__qualifier">
        {qualifier ?? DATA_ORIGIN_QUALIFIER[origin]}
      </p>
    </div>
  );
}

export function EvidenceSummary({
  rainfall,
  community,
  web,
  historical,
  demoMode,
  demoItems = [],
  className,
}: EvidenceSummaryProps) {
  return (
    <section
      className={['baharoute-evidence', className].filter(Boolean).join(' ')}
      aria-label="Flood evidence summary"
      data-testid="evidence-summary"
    >
      <h3 className="baharoute-evidence__title">Flood evidence</h3>

      <Category
        origin="LIVE_RAINFALL"
        label="Live rainfall"
        value={rainfall.unavailable || rainfall.valueText === null
          ? 'Unavailable'
          : rainfall.valueText}
        qualifier={
          rainfall.unavailable
            ? 'Near-real-time · currently unavailable'
            : `${DATA_ORIGIN_QUALIFIER.LIVE_RAINFALL} · ${rainfall.updatedText}`
        }
        testId="evidence-rainfall"
      />

      <Category
        origin="COMMUNITY_REPORT"
        label="Community reports"
        value={`${community.count} report${community.count === 1 ? '' : 's'}`}
        testId="evidence-community"
      />

      <Category
        origin="AI_WEB_EVIDENCE"
        label="Web evidence"
        value={
          web.agentUnavailable
            ? 'Agent unavailable'
            : `${web.count} recent article${web.count === 1 ? '' : 's'}`
        }
        qualifier={
          web.agentUnavailable
            ? 'AI-discovered · unavailable'
            : web.strongestConfidence
              ? `${DATA_ORIGIN_QUALIFIER.AI_WEB_EVIDENCE} · ${confidenceText(web.strongestConfidence)}`
              : DATA_ORIGIN_QUALIFIER.AI_WEB_EVIDENCE
        }
        testId="evidence-web"
      />

      <Category
        origin="HISTORICAL"
        label="Historical susceptibility"
        value={historical.classLabel ?? 'Unknown'}
        testId="evidence-historical"
      />

      {/* Demo row — ONLY when Demo Mode is active; every item is badged DEMO. */}
      {demoMode && demoItems.length > 0 && (
        <div className="baharoute-evidence__demo" data-testid="evidence-demo">
          {demoItems.map((item) => (
            <div
              key={item.label}
              className="baharoute-evidence__item baharoute-evidence__item--demo"
              data-origin="DEMO"
            >
              <p className="baharoute-evidence__label">
                {item.label} <DemoDataBadge label="DEMO" />
              </p>
              <p className="baharoute-evidence__value">{item.detail}</p>
              <p className="baharoute-evidence__qualifier">
                {DATA_ORIGIN_QUALIFIER.DEMO}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default EvidenceSummary;
