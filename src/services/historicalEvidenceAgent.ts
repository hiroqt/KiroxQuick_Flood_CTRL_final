// src/services/historicalEvidenceAgent.ts
//
// Pure logic for the HISTORICAL Flood Evidence Agent demo: filtering + the
// staged "agent" demo flow descriptor. This operates ONLY on the historical
// research dataset and has NO connection to live rainfall, current risk,
// community reports, official closures, or routing — historical evidence is
// context only and must never alter any current/operational state.

import type {
  HistoricalFloodEvidence,
  HistoricalLocationPrecision,
  HistoricalPassability,
} from '../types/historicalEvidence';
import { precisionAllowsPoint } from '../types/historicalEvidence';

/** Filter selection for the demo panel. `null`/'ALL' means "no filter". */
export interface HistoricalEvidenceFilter {
  readonly eventId?: string | null;
  readonly city?: string | null;
  readonly precision?: HistoricalLocationPrecision | null;
  readonly passability?: HistoricalPassability | null;
}

/**
 * Filters the historical dataset by event/city/precision/passability. Any
 * absent/null filter field is ignored. Pure; returns a new array.
 */
export function filterHistoricalEvidence(
  items: readonly HistoricalFloodEvidence[],
  filter: HistoricalEvidenceFilter = {},
): HistoricalFloodEvidence[] {
  return items.filter((e) => {
    if (filter.eventId && e.eventId !== filter.eventId) return false;
    if (filter.city && e.city !== filter.city) return false;
    if (filter.precision && e.locationPrecision !== filter.precision) return false;
    if (filter.passability && (e.passability ?? 'UNKNOWN') !== filter.passability) return false;
    return true;
  });
}

/** Only the items that can be placed on the map (EXACT/HIGH with a coordinate). */
export function mappableHistoricalEvidence(
  items: readonly HistoricalFloodEvidence[],
): HistoricalFloodEvidence[] {
  return items.filter(
    (e) => precisionAllowsPoint(e.locationPrecision) && e.coordinates !== undefined,
  );
}

/** One stage of the staged AI-agent demo flow. */
export interface AgentFlowStage {
  readonly key: string;
  readonly title: string;
  /** The ✓ confirmation line shown when the stage completes. */
  readonly result: string;
}

/**
 * Builds the staged "Historical Flood Evidence Agent" demo flow for a given
 * filtered result set. The results are DERIVED FROM THE REAL DATASET (counts,
 * a sample resolved location, a sample condition) — there are NO simulated
 * internet requests and nothing is presented as live. When no items match, the
 * stages still render with honest "none found" results.
 */
export function buildAgentFlow(
  all: readonly HistoricalFloodEvidence[],
  filtered: readonly HistoricalFloodEvidence[],
): AgentFlowStage[] {
  const mappable = mappableHistoricalEvidence(filtered);
  const sample = filtered[0];
  const resolved = mappable[0];
  const precisionBreakdown = summarizePrecision(filtered);

  return [
    {
      key: 'research',
      title: 'Research past flood records',
      result: `Evidence loaded — ${all.length} historical items (2009–2024)`,
    },
    {
      key: 'filter',
      title: 'Filter relevant flood evidence',
      result:
        filtered.length > 0
          ? `${filtered.length} relevant historical item${filtered.length === 1 ? '' : 's'} identified`
          : 'No historical items match the current filter',
    },
    {
      key: 'location',
      title: 'Extract location',
      result: sample
        ? `Location found — e.g. ${sample.locationDetail ?? sample.city ?? 'unspecified'}`
        : 'No location to extract',
    },
    {
      key: 'geography',
      title: 'Resolve geography',
      result: precisionBreakdown,
    },
    {
      key: 'condition',
      title: 'Extract flood condition',
      result: sample
        ? `${sample.floodCondition ?? 'Condition unspecified'} · ${sample.reportedDepth ?? 'depth n/a'} · ${sample.passability ?? 'UNKNOWN'}`
        : 'No flood condition to extract',
    },
    {
      key: 'provenance',
      title: 'Verify provenance',
      result: sample
        ? `Source retained — ${sample.sourceName}${sample.sourceUrl ? '' : ' (link unavailable in dataset)'}`
        : 'No source to verify',
    },
    {
      key: 'map',
      title: 'Add historical evidence to map',
      result:
        mappable.length > 0
          ? `${mappable.length} item${mappable.length === 1 ? '' : 's'} placed (EXACT/HIGH only)${resolved ? ` — e.g. ${resolved.locationDetail ?? resolved.city}` : ''}`
          : 'No mappable items (precision too low to place a point)',
    },
  ];
}

/** A short textual precision breakdown for the "resolve geography" stage. */
function summarizePrecision(items: readonly HistoricalFloodEvidence[]): string {
  if (items.length === 0) return 'Nothing to resolve';
  const counts: Record<HistoricalLocationPrecision, number> = {
    EXACT: 0,
    HIGH: 0,
    APPROXIMATE: 0,
    CITY_ONLY: 0,
    UNRESOLVED: 0,
  };
  for (const e of items) counts[e.locationPrecision] += 1;
  const parts: string[] = [];
  if (counts.EXACT) parts.push(`${counts.EXACT} exact`);
  if (counts.HIGH) parts.push(`${counts.HIGH} high`);
  if (counts.APPROXIMATE) parts.push(`${counts.APPROXIMATE} approximate`);
  if (counts.CITY_ONLY) parts.push(`${counts.CITY_ONLY} city-only`);
  if (counts.UNRESOLVED) parts.push(`${counts.UNRESOLVED} unresolved`);
  return parts.join(' · ');
}
