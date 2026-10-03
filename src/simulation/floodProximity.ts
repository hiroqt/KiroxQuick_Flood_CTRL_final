import type { DriveHazard } from '../data/fixtures/driveHazards';
import { distanceMeters, pointAlong, type MeasuredRoute, type LngLat } from './routeGeometry';

export const FLOOD_ALERT_RADIUS_M = 900;

/** HUD and speech use the same geographic radius, ignoring floods already passed. */
export function nearbyFloods(
  traveledM: number,
  route: MeasuredRoute,
  hazards: ReadonlyArray<DriveHazard>,
  position: LngLat = pointAlong(route, traveledM),
) {
  return hazards
    .filter((h) => h.atM >= traveledM && h.atM <= route.length)
    .map((hazard) => ({
      hazard,
      distance: distanceMeters(position, hazard.position ?? pointAlong(route, hazard.atM)),
    }))
    .filter(({ distance }) => distance <= FLOOD_ALERT_RADIUS_M + 1e-6)
    .sort((a, b) => a.hazard.atM - b.hazard.atM);
}
