// src/components/overlays/ReportPopup.tsx
//
// Popup shown when a community report or an official closure marker is clicked
// (Phase 2, Req 10; Community Report V2 Phase 1 adds lifecycle details +
// actions for community reports). Community reports are ALWAYS labeled
// "Unverified community information" and are visually + textually distinct from
// official closures, which carry the confirming source. Never presents a
// community report as official, and never shows a fake confidence percentage.

import type { FloodState } from '../../types/flood';
import type {
  ReportDepth,
  ReportPassability,
  ReportSeverity,
} from '../../types/report';
import { CURRENT_RISK_COLORS } from '../../map/basemap/colorTokens';
import { formatRelativeTime } from '../../layers/riskLabels';
import {
  reportFreshness,
  reportFreshnessLabel,
} from '../../services/reportResolution';
import {
  depthLabel,
  deriveSeverity,
  severityLabel,
  passabilityLabel,
} from '../../services/reportLifecycle';
import { Disclaimer } from './Disclaimer';

export interface ReportPopupProps {
  kind: 'community' | 'official';
  /** Report id (community only) — identifies the report for lifecycle actions. */
  id?: string;
  /** Report severity/state (community reports). */
  state?: FloodState;
  /** Barangay name/label if resolved. */
  barangay?: string;
  /** Optional free-text note (community note or official closure note). */
  note?: string;
  /** Timestamp (epoch seconds). */
  updatedAt: number | null;
  /** Source label. */
  source: string;

  // ---- Community Report V2 (community only; all optional) ----
  /** Structured depth choice, for display. */
  depth?: ReportDepth;
  /** Structured passability choice, for display. */
  passability?: ReportPassability;
  /** Severity derived from the reported water depth and passability. */
  severity?: ReportSeverity;
  /** Lifecycle: 'ACTIVE' | 'RESOLVED' (absent → ACTIVE). */
  lifecycle?: string;
  /** Number of community confirmations. */
  confirmationCount?: number;
  /** Epoch seconds of the most recent confirmation. */
  lastConfirmedAt?: number | null;
  /** Epoch seconds when flooding was marked cleared. */
  resolvedAt?: number | null;

  // ---- Lifecycle actions (community only; optional) ----
  onConfirm?: () => void;
  onConditionsChanged?: () => void;
  onResolve?: () => void;

  className?: string;
}

export function ReportPopup({
  kind,
  state,
  severity,
  barangay,
  note,
  updatedAt,
  source,
  depth,
  passability,
  lifecycle,
  confirmationCount,
  lastConfirmedAt,
  resolvedAt,
  onConfirm,
  onConditionsChanged,
  onResolve,
  className,
}: ReportPopupProps) {
  const isOfficial = kind === 'official';

  // Official closures keep their existing, deliberately-stronger presentation.
  if (isOfficial) {
    return (
      <section
        className={['baharoute-report-popup', className].filter(Boolean).join(' ')}
        aria-label="Official closure"
        data-testid="report-popup"
        data-kind="official"
      >
        <p className="baharoute-flood-popup__chip">
          <span
            aria-hidden="true"
            className="baharoute-flood-popup__swatch"
            style={{ backgroundColor: CURRENT_RISK_COLORS.CONFIRMED_NOT_PASSABLE.hex }}
          />
          Confirmed Closure
        </p>
        <dl className="baharoute-flood-popup__fields">
          {barangay && (
            <>
              <dt>Barangay</dt>
              <dd data-testid="report-barangay">{barangay}</dd>
            </>
          )}
          <dt>Status</dt>
          <dd data-testid="report-status">Official confirmation</dd>
          {note && (
            <>
              <dt>Note</dt>
              <dd data-testid="report-note">{note}</dd>
            </>
          )}
          <dt>Reported</dt>
          <dd data-testid="report-time">{formatRelativeTime(updatedAt)}</dd>
          <dt>Source</dt>
          <dd data-testid="report-source">{source}</dd>
        </dl>
        <Disclaimer variant="general" />
      </section>
    );
  }

  // ---- Community report card (realism pass) ----
  const isResolved = lifecycle === 'RESOLVED';
  const depthText = depth && depth !== 'UNKNOWN' ? depthLabel(depth) : null;
  const passText =
    passability && passability !== 'UNKNOWN' ? passabilityLabel(passability) : null;
  const confirmations = confirmationCount ?? 0;
  const freshness = updatedAt !== null ? reportFreshness(updatedAt) : null;
  const canAct = !isResolved && (onConfirm || onConditionsChanged || onResolve);
  const hasNote =
    typeof note === 'string' &&
    note.trim().length > 0 &&
    // Treat the generic auto-description as "no user note".
    !note.startsWith('User-submitted community report');

  const effectiveSeverity = severity ?? (
    depth || passability
      ? deriveSeverity(depth ?? 'UNKNOWN', passability ?? 'UNKNOWN')
      : state === 'RED' ? 'SEVERE'
        : state === 'ORANGE' ? 'MODERATE'
          : state === 'YELLOW' ? 'MINOR' : 'UNSURE'
  );
  const date = updatedAt !== null && Number.isFinite(updatedAt)
    ? new Date(updatedAt * 1000) : null;
  const validDate = date && Number.isFinite(date.getTime()) ? date : null;
  const details = (
    <dl className="baharoute-flood-popup__fields">
      {barangay && <><dt>Barangay</dt><dd data-testid="report-barangay">{barangay}</dd></>}
      <dt>Last updated</dt>
      <dd data-testid="report-date-time">
        {validDate ? (
          <time dateTime={validDate.toISOString()}>
            {new Intl.DateTimeFormat('en-PH', {
              timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric',
              hour: 'numeric', minute: '2-digit', hour12: true,
            }).format(validDate)} (PHT)
          </time>
        ) : 'Date and time unavailable'}
      </dd>
      <dt>Severity</dt>
      <dd data-testid="report-severity">{severityLabel(effectiveSeverity)}</dd>
      <dt>Water depth</dt>
      <dd data-testid="report-depth">{depthLabel(depth ?? 'UNKNOWN')}</dd>
      <dt>Passability</dt>
      <dd data-testid="report-passability">{passabilityLabel(passability ?? 'UNKNOWN')}</dd>
      <dt>Status</dt>
      <dd data-testid="report-status">{isResolved ? 'Resolved · flooding cleared' : 'Active community report'}</dd>
      <dt>Source</dt>
      <dd data-testid="report-source">{source || 'Community report'}</dd>
    </dl>
  );
  const noteBlock = (
    <div className="baharoute-report-popup__note-block">
      <p className="baharoute-report-popup__note-title">Note</p>
      <p className="baharoute-report-popup__note" data-testid="report-note">
        {hasNote ? note : 'No note provided'}
      </p>
    </div>
  );

  // RESOLVED variant: a calm, historical card that states it no longer affects risk.
  if (isResolved) {
    return (
      <section
        className={['baharoute-report-popup baharoute-report-popup--resolved', className]
          .filter(Boolean)
          .join(' ')}
        aria-label="Resolved community report"
        data-testid="report-popup"
        data-kind="community"
        data-lifecycle="RESOLVED"
      >
        <p className="baharoute-report-popup__eyebrow">Resolved community report</p>
        <p className="baharoute-report-popup__headline" data-testid="report-headline">
          Flooding reported earlier
        </p>
        <p className="baharoute-report-popup__meta">
          Conditions marked cleared {formatRelativeTime(resolvedAt ?? updatedAt)}
        </p>
        <p className="baharoute-report-popup__resolved-note" data-testid="report-resolved-note">
          This report is no longer contributing to current flood risk.
        </p>
        {details}
        {noteBlock}
        <p className="baharoute-report-popup__trust">Community information · unverified</p>
        <Disclaimer variant="general" />
      </section>
    );
  }

  return (
    <section
      className={['baharoute-report-popup', className].filter(Boolean).join(' ')}
      aria-label="Community report"
      data-testid="report-popup"
      data-kind="community"
      data-lifecycle={lifecycle ?? 'ACTIVE'}
    >
      <p className="baharoute-report-popup__eyebrow">Community flood report</p>

      {/* Headline: observed condition first (depth), then passability. */}
      <p className="baharoute-report-popup__headline" data-testid="report-headline">
        {depthText ? `${depthText} flooding` : 'Flooding reported'}
      </p>
      {passText && (
        <p className="baharoute-report-popup__pass" data-testid="report-pass">
          {passText}
        </p>
      )}

      {details}

      {/* Freshness line with a status dot. */}
      {freshness && (
        <p
          className={`baharoute-report-popup__freshness baharoute-report-popup__freshness--${freshness}`}
          data-testid="report-freshness"
        >
          <span aria-hidden="true" className="baharoute-report-popup__dot" />
          {reportFreshnessLabel(freshness)} · {formatRelativeTime(updatedAt)}
        </p>
      )}

      {/* Confirmations with explicit empty states. */}
      <p className="baharoute-report-popup__confirmations" data-testid="report-confirmations">
        {confirmations === 0
          ? 'No confirmations yet'
          : `${confirmations} community confirmation${confirmations === 1 ? '' : 's'}`}
      </p>
      <p className="baharoute-report-popup__confirmed-time" data-testid="report-confirmed-time">
        {lastConfirmedAt
          ? `Last confirmed ${formatRelativeTime(lastConfirmedAt)}`
          : 'No recent confirmation'}
      </p>

      {noteBlock}

      {/* Trust line — always obvious, never implies official/verified/safe. */}
      <div className="baharoute-report-popup__trust-block" data-testid="report-trust">
        <p className="baharoute-report-popup__trust">Community information</p>
        <p className="baharoute-report-popup__trust-sub">
          This report has not been officially verified.
        </p>
      </div>

      {canAct && (
        <div className="baharoute-report-popup__actions" data-testid="report-actions">
          {onConfirm && (
            <button
              type="button"
              className="baharoute-report-popup__action baharoute-focus-ring"
              onClick={onConfirm}
              data-testid="report-action-confirm"
            >
              Confirm flooding
            </button>
          )}
          {onConditionsChanged && (
            <button
              type="button"
              className="baharoute-report-popup__action baharoute-focus-ring"
              onClick={onConditionsChanged}
              data-testid="report-action-update"
            >
              Conditions changed
            </button>
          )}
          {onResolve && (
            <button
              type="button"
              className="baharoute-report-popup__action baharoute-report-popup__action--resolve baharoute-focus-ring"
              onClick={onResolve}
              data-testid="report-action-resolve"
            >
              Flood cleared
            </button>
          )}
        </div>
      )}

      <Disclaimer variant="general" />
    </section>
  );
}

export default ReportPopup;
