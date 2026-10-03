// src/components/overlays/HistoricalEvidencePopup.tsx
//
// Detail popup for a HISTORICAL flood-evidence item. It is a RESEARCH/ARCHIVE
// card: it always carries the HISTORICAL badge + "Not Current Conditions"
// framing, keeps event date and publication date distinct, shows the precision
// and passability, and shows "Source link unavailable in research dataset" when
// the dataset has no URL. It never says live/current/safe and never implies
// current flooding.

import {
  HISTORICAL_BADGE,
  HISTORICAL_NOT_CURRENT_LABEL,
  HISTORICAL_RECORD_DISCLAIMER,
  HISTORICAL_SOURCE_UNAVAILABLE,
  historicalPassabilityLabel,
  precisionLabel,
  type HistoricalLocationPrecision,
  type HistoricalPassability,
} from '../../types/historicalEvidence';
import { Disclaimer } from './Disclaimer';

export interface HistoricalEvidencePopupProps {
  title: string;
  city?: string;
  eventLabel?: string;
  eventDate?: string;
  publicationDate?: string;
  floodCondition?: string;
  reportedDepth?: string;
  passability?: HistoricalPassability | string;
  sourceName: string;
  /** Empty string / null / undefined → render the "unavailable" message. */
  sourceUrl?: string | null;
  locationPrecision: HistoricalLocationPrecision | string;
  className?: string;
}

export function HistoricalEvidencePopup({
  title,
  city,
  eventLabel,
  eventDate,
  publicationDate,
  floodCondition,
  reportedDepth,
  passability,
  sourceName,
  sourceUrl,
  locationPrecision,
  className,
}: HistoricalEvidencePopupProps) {
  const hasUrl = typeof sourceUrl === 'string' && sourceUrl.trim().length > 0;
  const conditionLine = [floodCondition, reportedDepth]
    .filter((s) => s && s.trim().length > 0)
    .join(' · ');
  const passLabel = historicalPassabilityLabel(passability as HistoricalPassability);
  const precLabel = precisionLabel(locationPrecision as HistoricalLocationPrecision);

  return (
    <section
      className={['baharoute-historical-popup', className].filter(Boolean).join(' ')}
      aria-label="Historical flood evidence"
      data-testid="historical-evidence-popup"
    >
      {/* Eyebrow: HISTORICAL badge + archive label. */}
      <p className="baharoute-historical-popup__eyebrow">
        <span className="baharoute-historical-badge" data-testid="historical-badge">
          {HISTORICAL_BADGE}
        </span>{' '}
        <span className="baharoute-historical-popup__eyebrow-text">Flood evidence record</span>
      </p>

      {/* Headline + city + event. */}
      <p className="baharoute-historical-popup__headline" data-testid="historical-title">
        {title}
      </p>
      <p className="baharoute-historical-popup__context">
        {city && (
          <span className="baharoute-historical-popup__city" data-testid="historical-city">
            {city}
          </span>
        )}
        {eventLabel && (
          <span className="baharoute-historical-popup__event" data-testid="historical-event">
            {eventLabel}
          </span>
        )}
      </p>

      {/* Quick-glance status chips: precision + passability. */}
      <div className="baharoute-historical-popup__chips">
        <span className="baharoute-historical-popup__chip" data-testid="historical-precision">
          {precLabel}
        </span>
        <span className="baharoute-historical-popup__chip">{passLabel}</span>
      </div>

      {/* Structured detail. */}
      <dl className="baharoute-flood-popup__fields baharoute-historical-popup__fields">
        <dt>Event date</dt>
        <dd data-testid="historical-event-date">{eventDate || 'Not specified'}</dd>

        <dt>Published</dt>
        <dd data-testid="historical-pub-date">{publicationDate || 'Not specified'}</dd>

        <dt>Reported condition</dt>
        <dd data-testid="historical-condition">
          {conditionLine || 'Not specified'} · {passLabel}
        </dd>

        <dt>Source</dt>
        <dd data-testid="historical-source">
          {sourceName}
          {!hasUrl && (
            <>
              {' '}
              <span className="baharoute-historical-popup__nourl">
                — {HISTORICAL_SOURCE_UNAVAILABLE}
              </span>
            </>
          )}
        </dd>
        {hasUrl && (
          <>
            <dt>Link</dt>
            <dd>
              <a
                href={sourceUrl as string}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="historical-source-link"
              >
                View source
              </a>
            </dd>
          </>
        )}
      </dl>

      {/* Explicit historical-record framing. */}
      <div className="baharoute-historical-popup__record" data-testid="historical-record-note">
        <p className="baharoute-historical-popup__record-title">HISTORICAL RECORD</p>
        <p className="baharoute-historical-popup__record-sub">{HISTORICAL_RECORD_DISCLAIMER}</p>
        <p className="baharoute-historical-popup__record-sub">{HISTORICAL_NOT_CURRENT_LABEL}</p>
      </div>

      <Disclaimer variant="general" />
    </section>
  );
}

export default HistoricalEvidencePopup;
