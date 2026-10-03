import { measureRoute, pointAlong, type LngLat } from '../simulation/routeGeometry';

/** Nearby parallel traces within 35 m count as the same road corridor. */
const CORRIDOR_M = 35;
const MAX_SAMPLES = 240;

export function isUsableRouteGeometry(route: ReadonlyArray<LngLat>): boolean {
  return route.length >= 2 && route.every(([lng, lat]) =>
    Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90,
  ) && measureRoute(route).length >= 1;
}

function distanceToPath(point: LngLat, path: ReadonlyArray<LngLat>): number {
  const scale = Math.cos(point[1] * Math.PI / 180);
  const project = (p: LngLat): LngLat => [(p[0] - point[0]) * 111320 * scale, (p[1] - point[1]) * 111320];
  let closest = Infinity;
  for (let i = 1; i < path.length; i += 1) {
    const a = project(path[i - 1]);
    const b = project(path[i]);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / lengthSquared)) : 0;
    closest = Math.min(closest, Math.hypot(a[0] + t * dx, a[1] + t * dy));
    if (closest <= CORRIDOR_M) break;
  }
  return closest;
}

function uniqueLength(route: ReadonlyArray<LngLat>, other: ReadonlyArray<LngLat>): number {
  const measured = measureRoute(route);
  const count = Math.min(MAX_SAMPLES, Math.max(1, Math.ceil(measured.length / 50)));
  let unique = 0;
  for (let i = 0; i < count; i += 1) {
    if (distanceToPath(pointAlong(measured, measured.length * (i + 0.5) / count), other) > CORRIDOR_M) unique += 1;
  }
  return measured.length * unique / count;
}

/** Compares geometry, independent of IDs, vertex density, distance or ETA labels. */
export function compareRoutePaths(a: ReadonlyArray<LngLat>, b: ReadonlyArray<LngLat>) {
  if (!isUsableRouteGeometry(a) || !isUsableRouteGeometry(b)) {
    return { sharedPathPercent: 100, differentDistanceM: 0, meaningful: false };
  }
  const firstLength = measureRoute(a).length;
  const secondLength = measureRoute(b).length;
  const firstUnique = uniqueLength(a, b);
  const secondUnique = uniqueLength(b, a);
  const requiredDifferenceM = Math.min(500, Math.max(75, Math.min(firstLength, secondLength) * 0.1));
  return {
    sharedPathPercent: Math.round(100 * (1 - (firstUnique + secondUnique) / (firstLength + secondLength))),
    differentDistanceM: Math.max(firstUnique, secondUnique),
    meaningful: Math.max(firstUnique, secondUnique) >= requiredDifferenceM,
  };
}
