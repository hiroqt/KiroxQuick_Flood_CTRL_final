import { floodStateLabel } from '../../layers/visualMapping';
import { FLOOD_STATE_COLORS } from '../../map/basemap/colorTokens';
import type { DriveHazard } from '../../data/fixtures/driveHazards';
import { formatDistance, formatDuration } from '../../simulation/navigation';
import { formatRerouteDelta, type RerouteOffer as Offer } from '../../simulation/reroute';

export interface RerouteOfferProps {
  offer?: Offer | null;
  alternatives?: readonly Offer[];
  status?: 'searching' | 'unavailable' | null;
  hazard: DriveHazard;
  toHazardM: number;
  onReroute: (offer?: Offer) => void;
  onKeep: () => void;
  onReview?: () => void;
  onRetry?: () => void;
}

export function RerouteOffer({
  offer,
  alternatives,
  status,
  hazard,
  toHazardM,
  onReroute,
  onKeep,
  onReview,
  onRetry,
}: RerouteOfferProps) {
  const options = alternatives ?? (offer ? [offer] : []);
  const passable = hazard.passability === 'passable';
  return (
    <section
      className="baharoute-reroute"
      role="alertdialog"
      aria-live="assertive"
      aria-labelledby="baharoute-reroute-title"
      aria-describedby="baharoute-reroute-desc"
      style={{ borderTopColor: FLOOD_STATE_COLORS[hazard.state].hex }}
    >
      {onReview && (
        <button
          type="button"
          className="baharoute-trip-panel__back baharoute-focus-ring"
          onClick={onReview}
        >
          ← Back to route selection
        </button>
      )}
      <h2 id="baharoute-reroute-title" className="baharoute-reroute__title">
        {hazard.passability
          ? `${hazard.isDemo === false ? 'Reported flood' : 'Demo flood'} — ${passable ? 'passable' : 'not passable'}`
          : floodStateLabel(hazard.state)}{' '}
        ahead · {formatDistance(toHazardM)}
      </h2>
      <p id="baharoute-reroute-desc" className="baharoute-reroute__desc">
        {passable
          ? 'Choose whether to continue or take an avoiding route.'
          : 'Not passable: choose a route that avoids this flood.'}{' '}
        Simulation keeps moving.{' '}
        {hazard.isDemo === false ? hazard.sourceLabel : 'Demo report, unconfirmed.'}
        {offer?.isRetry && ' Earlier alternative missed. New alternative available.'}
      </p>
      {status === 'searching' && <p role="status">Finding flood-avoiding road alternatives…</p>}
      {status === 'unavailable' && (
        <p role="status">
          No joinable flood-avoiding road route found yet. Retry from your current position or
          review other routes.
        </p>
      )}
      <div role="group" aria-label="Route options" className="baharoute-reroute__options">
        {options.map((option, index) => (
          <button
            key={`${option.reroute.hazardId}-${index}`}
            type="button"
            className={`baharoute-reroute__option baharoute-focus-ring${index === 0 ? ' baharoute-reroute__option--primary' : ''}`}
            onClick={() => onReroute(option)}
          >
            <strong>
              {index === 0
                ? 'Fastest available flood-avoiding route'
                : `Alternative route ${index + 1}`}
            </strong>
            <span>
              {option.durationS ? `${formatDuration(option.durationS)} · ` : ''}
              {formatDistance(option.directRoute?.lengthM ?? option.reroute.distanceM)}
            </span>
            <span>Avoids the flood-risk area · {formatRerouteDelta(option)}</span>
            <span>Turn-off in {formatDistance(option.toBranchM)}</span>
          </button>
        ))}
        {passable && (
          <button
            type="button"
            className="baharoute-reroute__option baharoute-focus-ring"
            onClick={onKeep}
          >
            <strong>Continue on passable route</strong>
            <span>Keep this route through the reported flood</span>
          </button>
        )}
        {onRetry && (
          <button
            type="button"
            className="baharoute-reroute__option baharoute-focus-ring"
            onClick={onRetry}
          >
            <strong>Find alternative routes</strong>
            <span>Search from your current position</span>
          </button>
        )}
      </div>
    </section>
  );
}
export default RerouteOffer;
