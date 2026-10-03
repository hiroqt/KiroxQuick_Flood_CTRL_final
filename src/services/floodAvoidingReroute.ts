import { compareRoutePaths } from './routeValidation';
import {
  planRoutes,
  summarizeRouteRisk,
  type PlanRoutesOptions,
  type RoutePlanningContext,
  type RouteCandidate,
} from './routePlanning';
import {
  measureRoute,
  nearestAlong,
  distanceMeters,
  type LngLat,
} from '../simulation/routeGeometry';
import { branchPoint, stitchReroute, type RerouteOffer } from '../simulation/reroute';
import type { RouteManeuver } from '../data/fixtures/pitxToMoaRoute';
import type { MeasuredRoute } from '../simulation/routeGeometry';

export const FLOOD_AVOIDANCE_CLEARANCE_M = 50;

/** Search nearby road corridors on both sides of the nearest obstruction. */
function floodDetourWaypoints(position: LngLat, destination: LngLat, floods: readonly LngLat[]): LngLat[] {
  const nearest = [...floods].sort((a, b) => distanceMeters(position, a) - distanceMeters(position, b))[0];
  if (!nearest) return [];
  const lngScale = Math.cos(nearest[1] * Math.PI / 180);
  const dx = (destination[0] - position[0]) * lngScale;
  const dy = destination[1] - position[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return [];
  return [200, 450, 900, 1500].flatMap((meters) => [-1, 1].map((side): LngLat => [
    nearest[0] - dy / length * meters / 111320 * side / lngScale,
    nearest[1] + dx / length * meters / 111320 * side,
  ]));
}

/** Reject whole polylines that intersect a flood, not just routes with different vertices. */
export function avoidsFloodPoints(
  route: ReadonlyArray<LngLat>,
  floods: ReadonlyArray<LngLat>,
): boolean {
  const measured = measureRoute(route);
  return (
    route.length >= 2 &&
    measured.length > 0 &&
    floods.every((point) => nearestAlong(measured, point).offM >= FLOOD_AVOIDANCE_CLEARANCE_M)
  );
}

/** Only actual provider roads can become an offer; never use the direct-line fallback. */
export async function findFloodAvoidingReroutes(
  position: LngLat,
  destination: LngLat,
  floods: ReadonlyArray<LngLat>,
  hazardId: string,
  remainingM: number,
  speedMps: number,
  options: PlanRoutesOptions,
  context: RoutePlanningContext = {},
  fallbackCandidates: readonly RouteCandidate[] = [],
): Promise<RerouteOffer[]> {
  const provider = await planRoutes(position, destination, {
    ...options,
    excludePoints: floods,
    avoidanceWaypoints: floodDetourWaypoints(position, destination, floods),
    routeFilter: (route) =>
      avoidsFloodPoints(route.geometry, floods) &&
      (!options.routeFilter || options.routeFilter(route)) &&
      isEligibleRisk(summarizeRouteRisk({
        id: 'detour-search', label: 'Detour search', route: route.geometry,
        maneuvers: route.maneuvers, durationS: route.durationS, distanceM: route.distanceM, hazards: [],
      }, context)),
  });
  return rankFloodAvoidingOffers([...provider, ...fallbackCandidates], position, destination,
    floods, hazardId, remainingM, speedMps, context);
}

/** Make already known road detours available while provider searches continue. */
export function rankFloodAvoidingOffers(
  candidates: readonly RouteCandidate[], position: LngLat, destination: LngLat,
  floods: readonly LngLat[], hazardId: string, remainingM: number, speedMps: number,
  context: RoutePlanningContext = {},
): RerouteOffer[] {
  const eligible = candidates.filter((c) => {
    if (
      c.id === 'direct-line' ||
      !Number.isFinite(c.durationS) ||
      c.durationS <= 0 ||
      !avoidsFloodPoints(c.route, floods) ||
      distanceMeters(position, c.route[0]) > 3 ||
      distanceMeters(destination, c.route[c.route.length - 1]) > 30
    )
      return false;
    const risk = summarizeRouteRisk(c, context);
    return isEligibleRisk(risk);
  });
  eligible.sort((a, b) => a.durationS - b.durationS || a.distanceM - b.distanceM);
  const distinct = eligible.filter(
    (candidate, i) =>
      !eligible
        .slice(0, i)
        .some((other) => !compareRoutePaths(candidate.route, other.route).meaningful),
  );
  return distinct.slice(0, 3).map((candidate) => {
    const lengthM = measureRoute(candidate.route).length;
    const extraM = lengthM - remainingM;
    return {
      reroute: {
        hazardId,
        fromM: 0,
        distanceM: lengthM,
        originalRemainingM: remainingM,
        route: candidate.route,
        maneuvers: candidate.maneuvers,
      },
      directRoute: { route: [...candidate.route], maneuvers: [...candidate.maneuvers], lengthM },
      durationS: candidate.durationS,
      toBranchM: 0,
      extraM,
      extraS: candidate.durationS - (speedMps > 0 ? remainingM / speedMps : 0),
      isRetry: false,
    };
  });
}

function isEligibleRisk(risk: ReturnType<typeof summarizeRouteRisk>): boolean {
  return risk.closureCount === 0 && risk.level !== 'REPORTED_FLOODING' && risk.level !== 'CONFIRMED_NOT_PASSABLE';
}

/** Compatibility helper for callers needing only the fastest available option. */
export async function findFloodAvoidingReroute(
  ...args: Parameters<typeof findFloodAvoidingReroutes>
): Promise<RerouteOffer | null> {
  return (await findFloodAvoidingReroutes(...args))[0] ?? null;
}

/** Rejoin a proposal from the moving vehicle, without reversing or teleporting. */
export function rebaseMovingReroute(
  offer: RerouteOffer,
  base: MeasuredRoute,
  maneuvers: ReadonlyArray<RouteManeuver>,
  traveledM: number,
  floods: readonly LngLat[],
): RerouteOffer | null {
  const branch = branchPoint(base, offer.reroute);
  if (!branch || branch.baseM < traveledM) return null;
  const next = stitchReroute(base, maneuvers, offer.reroute, traveledM);
  if (!next || !avoidsFloodPoints(next.route, floods)) return null;
  const originalLength = measureRoute(offer.reroute.route).length;
  return {
    ...offer,
    directRoute: next,
    toBranchM: branch.baseM - traveledM,
    durationS:
      offer.durationS === undefined ? undefined : (offer.durationS * next.lengthM) / originalLength,
  };
}
