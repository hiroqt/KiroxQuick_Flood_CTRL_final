import type { FloodReport } from '../types/flood';
import type { CommunityReport } from '../types/report';
import { reportFreshness } from './reportResolution';
import type { DriveHazard } from '../data/fixtures/driveHazards';
import type { RouteCandidate } from './routePlanning';
import {
  distanceMeters,
  measureRoute,
  nearestAlong,
  pointAlong,
  type LngLat,
} from '../simulation/routeGeometry';
import { FLOOD_AVOIDANCE_CLEARANCE_M } from './floodAvoidingReroute';

export interface LocatedRouteFlood {
  position: LngLat;
  hazard: DriveHazard;
}

/** A flood on a shared road must warn every route that uses that road. */
export function collectRouteFloods(candidates: readonly RouteCandidate[]): LocatedRouteFlood[] {
  const floods: LocatedRouteFlood[] = [];
  for (const candidate of candidates) {
    const measured = measureRoute(candidate.route);
    for (const hazard of [...(candidate.demoFloods ?? []), ...candidate.hazards]) {
      if (hazard.atM < 0 || hazard.atM > measured.length || !measured.length) continue;
      const position = pointAlong(measured, hazard.atM);
      if (
        floods.some(
          (f) => f.hazard.state === hazard.state && distanceMeters(f.position, position) < 3,
        )
      )
        continue;
      floods.push({ position, hazard: { ...hazard, id: `${candidate.id}:${hazard.id}` } });
    }
  }
  return floods;
}

/** Project only known floods intersecting this road; do not inject another demo. */
export function floodHazardsOnRoute(
  route: ReadonlyArray<LngLat>,
  floods: readonly LocatedRouteFlood[],
): DriveHazard[] {
  const measured = measureRoute(route);
  return floods
    .flatMap(({ position, hazard }) => {
      const nearest = nearestAlong(measured, position);
      return nearest.offM < FLOOD_AVOIDANCE_CLEARANCE_M ? [{ ...hazard, atM: nearest.alongM, position }] : [];
    })
    .sort((a, b) => a.atM - b.atM);
}

/** Current point reports, respecting report TTL and resolved community observations. */
export function collectReportedFloods(
  reports: readonly (FloodReport | CommunityReport)[],
  isDemo: boolean,
  now = Math.floor(Date.now() / 1000),
): LocatedRouteFlood[] {
  return reports.flatMap((report) => {
    if (
      !report.metadata ||
      ('lifecycle' in report && report.lifecycle === 'RESOLVED') ||
      reportFreshness(report.metadata.updatedAt, now) === 'expired' ||
      !['RED', 'ORANGE', 'YELLOW'].includes(report.state)
    )
      return [];
    const { lng, lat } = report.metadata.location;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];
    return [
      {
        position: [lng, lat] as LngLat,
        hazard: {
          id: `report:${report.id}`,
          atM: 0,
          state: report.state as DriveHazard['state'],
          street: 'Reported flood location',
          isDemo,
          sourceLabel: report.metadata.source,
          passability:
            report.passable === undefined
              ? undefined
              : report.passable
                ? ('passable' as const)
                : ('not-passable' as const),
        },
      },
    ];
  });
}
