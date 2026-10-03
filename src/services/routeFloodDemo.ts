import type { DriveHazard } from '../data/fixtures/driveHazards';
import type { RouteManeuver } from '../data/fixtures/pitxToMoaRoute';
import { measureRoute, type LngLat } from '../simulation/routeGeometry';

export interface RouteFloodDemo extends DriveHazard {
  passability: 'passable' | 'not-passable';
}

/** One simulation point on this path, never live closure evidence. */
export function createRouteFloodDemo(
  route: ReadonlyArray<LngLat>,
  maneuvers: ReadonlyArray<RouteManeuver>,
  passability: RouteFloodDemo['passability'],
  existing: ReadonlyArray<DriveHazard> = [],
): RouteFloodDemo[] {
  if (
    route.length < 2 ||
    route.some(([lng, lat]) => !Number.isFinite(lng) || !Number.isFinite(lat))
  )
    return [];
  const { length } = measureRoute(route);
  if (!(length > 0)) return [];
  const state = passability === 'passable' ? 'YELLOW' : 'RED';
  // Preserve a matching flagship hazard so its existing reroute still branches correctly.
  const seed = existing.find((h) => h.state === state && h.atM > 0 && h.atM < length);
  const atM = seed?.atM ?? length / 2;
  return [
    {
      id: seed?.id ?? `demo-route-${passability}`,
      atM,
      state,
      passability,
      street:
        seed?.street ||
        [...maneuvers].reverse().find((m) => m.atM <= atM && m.street)?.street ||
        'Selected route',
    },
  ];
}

interface DemoRoute {
  readonly route: ReadonlyArray<LngLat>;
  readonly maneuvers: ReadonlyArray<RouteManeuver>;
  readonly hazards: ReadonlyArray<DriveHazard>;
}

/** Two demos per journey, assigned to different options; never both on one option. */
export function assignRouteFloodDemos<T extends DemoRoute>(
  candidates: readonly T[],
): Array<T & { demoFloods: RouteFloodDemo[] }> {
  const usable = candidates.filter(
    (candidate) =>
      createRouteFloodDemo(candidate.route, candidate.maneuvers, 'passable').length > 0,
  );
  const passable = usable[1] ?? usable[0];
  const notPassable = usable.length >= 2 ? usable[0] : undefined;
  return candidates.map((candidate) => ({
    ...candidate,
    demoFloods:
      candidate === passable || candidate === notPassable
        ? createRouteFloodDemo(
            candidate.route,
            candidate.maneuvers,
            candidate === notPassable ? 'not-passable' : 'passable',
            candidate.hazards,
          )
        : [],
  }));
}
