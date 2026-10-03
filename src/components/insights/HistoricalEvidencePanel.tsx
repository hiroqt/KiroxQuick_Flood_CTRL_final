// src/components/insights/HistoricalEvidencePanel.tsx
//
// The "Historical Flood Evidence" panel: a dedicated research/demo surface that
// lists the historical dataset, offers event/city/precision/passability
// filters, and runs a staged AI-agent demo flow. It is framed everywhere as
// HISTORICAL / Demo / Research Use Only / Not Current Conditions, and never as
// live/current. Selecting an item asks the parent to open its historical popup
// / focus it on the map (map placement only for EXACT/HIGH items).
//
// This is a UI/UX surface ONLY — it reads the static historical dataset and the
// pure agent helpers. It never touches current flood risk, rainfall, community
// reports, official closures, or routing.

import { useMemo, useState } from 'react';
import type {
  HistoricalFloodEvidence,
  HistoricalLocationPrecision,
  HistoricalPassability,
} from '../../types/historicalEvidence';
import {
  HISTORICAL_BADGE,
  HISTORICAL_USE_LABEL,
  HISTORICAL_NOT_CURRENT_LABEL,
  precisionLabel,
  historicalPassabilityLabel,
} from '../../types/historicalEvidence';
import {
  filterHistoricalEvidence,
  buildAgentFlow,
  type HistoricalEvidenceFilter,
} from '../../services/historicalEvidenceAgent';
import { HISTORICAL_EVENTS, historicalCities } from '../../data/historical/historicalFloodEvidence';

export interface HistoricalEvidencePanelProps {
  /** The full historical dataset (15 items). */
  evidence: readonly HistoricalFloodEvidence[];
  /** Called when the filtered set changes, so the map layer can refresh. */
  onFilteredChange?: (filtered: HistoricalFloodEvidence[]) => void;
  /** Called when a list item is selected (opens its popup / focuses the map). */
  onSelect?: (item: HistoricalFloodEvidence) => void;
  /**
   * Called when the agent is run / hidden. `true` once the user runs the agent
   * (reveal the map markers), `false` when they hide the run again. Lets the
   * parent keep the on-map historical markers OFF until the agent has run.
   */
  onAgentRunChange?: (ran: boolean) => void;
  /** Close the panel. */
  onClose?: () => void;
  className?: string;
}

const PRECISIONS: readonly HistoricalLocationPrecision[] = [
  'EXACT',
  'HIGH',
  'APPROXIMATE',
  'CITY_ONLY',
  'UNRESOLVED',
];
const PASSABILITIES: readonly HistoricalPassability[] = ['PASSABLE', 'IMPASSABLE', 'UNKNOWN'];

/** The AI-agent workflow steps, shown as a compact pipeline above the CTA. */
const WORKFLOW_STEPS: readonly string[] = [
  'Research records',
  'Extract location',
  'Resolve precision',
  'Verify provenance',
  'Map evidence',
];

/** Short visual tone for a precision pill (muted; never a current-severity red). */
function precisionTone(p: HistoricalLocationPrecision): 'strong' | 'soft' | 'faint' {
  if (p === 'EXACT' || p === 'HIGH') return 'strong';
  if (p === 'APPROXIMATE') return 'soft';
  return 'faint';
}

/** Short visual tone for a passability pill. */
function passabilityTone(p: HistoricalPassability | undefined): 'block' | 'ok' | 'unknown' {
  if (p === 'IMPASSABLE') return 'block';
  if (p === 'PASSABLE') return 'ok';
  return 'unknown';
}

export function HistoricalEvidencePanel({
  evidence,
  onFilteredChange,
  onSelect,
  onAgentRunChange,
  onClose,
  className,
}: HistoricalEvidencePanelProps) {
  const [filter, setFilter] = useState<HistoricalEvidenceFilter>({});
  const [showFlow, setShowFlow] = useState(false);

  /** Toggles the agent run; also tells the parent so it can reveal/hide the map markers. */
  const toggleFlow = (): void => {
    setShowFlow((v) => {
      const next = !v;
      onAgentRunChange?.(next);
      return next;
    });
  };

  const filtered = useMemo(() => filterHistoricalEvidence(evidence, filter), [evidence, filter]);
  const flow = useMemo(() => buildAgentFlow(evidence, filtered), [evidence, filtered]);

  const update = (patch: Partial<HistoricalEvidenceFilter>): void => {
    const next = { ...filter, ...patch };
    setFilter(next);
    onFilteredChange?.(filterHistoricalEvidence(evidence, next));
  };

  return (
    <section
      className={['baharoute-hist-evidence', className].filter(Boolean).join(' ')}
      aria-label="Historical flood evidence"
      data-testid="historical-evidence-panel"
    >
      {/* Header: title + HISTORICAL badge + close. */}
      <header className="baharoute-hist-evidence__head">
        <div className="baharoute-hist-evidence__heading">
          <span className="baharoute-historical-badge" data-testid="historical-panel-badge">
            {HISTORICAL_BADGE}
          </span>
          <h2 className="baharoute-hist-evidence__title">Historical Flood Evidence</h2>
        </div>
        {onClose && (
          <button
            type="button"
            className="baharoute-hist-evidence__close baharoute-icon-button baharoute-focus-ring"
            aria-label="Close historical flood evidence"
            data-testid="historical-panel-close"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </header>

      {/* Disclaimer / subtitle — explicit, always visible. */}
      <p className="baharoute-hist-evidence__sub" data-testid="historical-panel-sub">
        {HISTORICAL_USE_LABEL} · {HISTORICAL_NOT_CURRENT_LABEL}
      </p>

      {/* AI agent workflow card: a short description + the pipeline + the Run
          CTA. Framed as a research agent over PAST records, never live. */}
      <div className="baharoute-hist-agent" data-testid="historical-agent-card">
        <p className="baharoute-hist-agent__lead">
          <span className="baharoute-hist-agent__spark" aria-hidden="true">
            ✦
          </span>
          AI agent that compiles PAST flood evidence (2009–2024) from government
          reports and news archives — then places only well-located records on the
          map.
        </p>
        <ol className="baharoute-hist-agent__pipeline" aria-hidden="true">
          {WORKFLOW_STEPS.map((step, i) => (
            <li key={step} className="baharoute-hist-agent__pipe-step">
              <span className="baharoute-hist-agent__pipe-dot">{i + 1}</span>
              <span className="baharoute-hist-agent__pipe-label">{step}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="baharoute-hist-agent__run baharoute-focus-ring"
          aria-expanded={showFlow}
          data-testid="historical-flow-toggle"
          onClick={toggleFlow}
        >
          <span className="baharoute-hist-agent__run-icon" aria-hidden="true">
            {showFlow ? '▾' : '▸'}
          </span>
          {showFlow ? 'Hide agent run' : 'Run Historical Flood Evidence Agent'}
        </button>
        {showFlow && (
          <ol className="baharoute-hist-agent__flow" data-testid="historical-agent-flow">
            {flow.map((stage) => (
              <li key={stage.key} className="baharoute-hist-agent__flow-step">
                <span className="baharoute-hist-agent__flow-title">{stage.title}</span>
                <span className="baharoute-hist-agent__flow-result">
                  <span className="baharoute-hist-agent__flow-check" aria-hidden="true">
                    ✓
                  </span>
                  {stage.result}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Filters — a clean 2×2 grid. */}
      <div className="baharoute-hist-filters" data-testid="historical-filters">
        <label className="baharoute-hist-filters__field">
          <span className="baharoute-hist-filters__label">Event</span>
          <select
            data-testid="historical-filter-event"
            value={filter.eventId ?? ''}
            onChange={(e) => update({ eventId: e.target.value || null })}
          >
            <option value="">All events</option>
            {HISTORICAL_EVENTS.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.label}
              </option>
            ))}
          </select>
        </label>
        <label className="baharoute-hist-filters__field">
          <span className="baharoute-hist-filters__label">City</span>
          <select
            data-testid="historical-filter-city"
            value={filter.city ?? ''}
            onChange={(e) => update({ city: e.target.value || null })}
          >
            <option value="">All cities</option>
            {historicalCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="baharoute-hist-filters__field">
          <span className="baharoute-hist-filters__label">Precision</span>
          <select
            data-testid="historical-filter-precision"
            value={filter.precision ?? ''}
            onChange={(e) =>
              update({ precision: (e.target.value as HistoricalLocationPrecision) || null })
            }
          >
            <option value="">All precision</option>
            {PRECISIONS.map((p) => (
              <option key={p} value={p}>
                {precisionLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="baharoute-hist-filters__field">
          <span className="baharoute-hist-filters__label">Passability</span>
          <select
            data-testid="historical-filter-passability"
            value={filter.passability ?? ''}
            onChange={(e) =>
              update({ passability: (e.target.value as HistoricalPassability) || null })
            }
          >
            <option value="">All</option>
            {PASSABILITIES.map((p) => (
              <option key={p} value={p}>
                {historicalPassabilityLabel(p)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Evidence count. */}
      <p className="baharoute-hist-evidence__count" data-testid="historical-count">
        <strong>{filtered.length}</strong> of {evidence.length} historical records
      </p>

      {/* Evidence cards. */}
      <ul className="baharoute-hist-evidence__list" data-testid="historical-list">
        {filtered.map((item) => {
          const mapped = item.coordinates !== undefined;
          return (
            <li key={item.id}>
              <button
                type="button"
                className="baharoute-hist-card baharoute-focus-ring"
                data-testid={`historical-item-${item.id}`}
                onClick={() => onSelect?.(item)}
              >
                <span className="baharoute-hist-card__top">
                  <span className="baharoute-hist-card__title">{item.title}</span>
                  <span className="baharoute-hist-card__year">{item.eventYear}</span>
                </span>
                <span className="baharoute-hist-card__city">{item.city ?? 'NCR'}</span>
                <span className="baharoute-hist-card__event">{item.eventLabel}</span>
                <span className="baharoute-hist-card__pills">
                  <span
                    className="baharoute-hist-pill baharoute-hist-pill--precision"
                    data-tone={precisionTone(item.locationPrecision)}
                  >
                    {precisionLabel(item.locationPrecision)}
                  </span>
                  <span
                    className="baharoute-hist-pill baharoute-hist-pill--pass"
                    data-tone={passabilityTone(item.passability)}
                  >
                    {historicalPassabilityLabel(item.passability)}
                  </span>
                  <span className="baharoute-hist-pill baharoute-hist-pill--status">
                    Historical
                  </span>
                  {!mapped && (
                    <span
                      className="baharoute-hist-pill baharoute-hist-pill--unmapped"
                      title="Precision too low to place a map point"
                    >
                      List only
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default HistoricalEvidencePanel;
