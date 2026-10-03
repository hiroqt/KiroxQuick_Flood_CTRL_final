// src/services/routePlanning.ts
//
// Route planning + FLOOD-AWARE route comparison for the Search → Compare flow.
//
// The demo pair has three bundled road routes. Other pairs use Mapbox alternatives,
// with bounded waypoint searches when the provider supplies only one path.
// Only distinct provider geometries are offered, with at most three choices.
//
// Route risk is AGGREGATED from BahaRoute's existing signals, per docs/
// FLOOD_SEMANTICS.md:
//   - live per-barangay current risk (sampled along the route geometry),
//   - demo flood hazards that sit on the route,
//   - confirmed official closures the route passes through (strongest signal),
//   - recent community reports on the route (supporting evidence only).
// UNKNOWN / STALE are treated as data-quality states — never as LOW. Historical
// susceptibility is supporting context only and never classifies a route as
// currently flooded on its own.

import { assignRouteFloodDemos, createRouteFloodDemo, type RouteFloodDemo } from './routeFloodDemo';
import type { CurrentRiskLevel, RainfallTrend } from '../types/risk';
import { isDataQualityState, riskSeverity } from '../types/risk';
import type { RouteManeuver } from '../data/fixtures/pitxToMoaRoute';
import {
  PITX_TO_MOA_ROUTE,
  PITX_TO_MOA_MANEUVERS,
} from '../data/fixtures/pitxToMoaRoute';
import { PITX_TO_MOA_HAZARDS, type DriveHazard } from '../data/fixtures/driveHazards';
import { PITX_TO_MOA_REROUTES } from '../data/fixtures/floodReroutes';
import { measureRoute, distanceMeters, type LngLat } from '../simulation/routeGeometry';
import { compareRoutePaths, isUsableRouteGeometry } from './routeValidation';
import { SIM_SPEED_MPS } from '../simulation/DriveSimulator';
import { resolveBarangayForPoint } from './reportResolution';
import {
  fetchDirectionsRoutes,
  type FetchLike,
  type TravelMode,
  type DirectionsRoute,
} from './directions';

export type { TravelMode };

/**
 * The user's optional route preference. `lowerFloodExposure` (default) ranks by
 * flood exposure first; `faster` ranks by travel time first. Preference only
 * REORDERS the provider's routes — it never changes geometry or invents routes.
 */
export type RoutePreference = 'lowerFloodExposure' | 'faster';

/** A concrete, drivable candidate route. */
export interface RouteCandidate {
  readonly id: string;
  readonly label: string;
  readonly route: ReadonlyArray<LngLat>;
  readonly maneuvers: ReadonlyArray<RouteManeuver>;
  readonly distanceM: number;
  /** Estimated real-world duration at the simulated average speed, seconds. */
  readonly durationS: number;
  /** Demo hazards that lie on THIS route (empty for a hazard-avoiding alt). */
  readonly hazards: ReadonlyArray<DriveHazard>;
  /** An optional route-relative demo point, separate from current risk evidence. */
  readonly demoFloods?: ReadonlyArray<RouteFloodDemo>;
}

/** A single "Why this route?" bullet. */
export interface RouteReason {
  readonly key: string;
  readonly text: string;
}

/** Aggregated flood-risk summary for a route (the Compare card model). */
export interface RouteRiskSummary {
  /** Overall route risk level (max severity across signals). */
  readonly level: CurrentRiskLevel;
  /** Number of higher-risk segments (HIGH or worse) sampled along the route. */
  readonly higherRiskSegments: number;
  /** Recent community reports resolving to barangays the route passes. */
  readonly reportCount: number;
  /**
   * Recent AI-discovered web-evidence items resolving to barangays the route
   * passes. A SUPPORTING signal only: it adds context to the explanation and a
   * mild exposure weight, but a single web/news result never hard-blocks a
   * route (only a confirmed official closure can). Never raises `level`.
   */
  readonly webEvidenceCount: number;
  /** Confirmed official closures the route passes through. */
  readonly closureCount: number;
  /** Rainfall trend if available, else 'unknown'. */
  readonly trend: RainfallTrend;
  /** True when route risk could not be classified (no usable current data). */
  readonly dataUnavailable: boolean;
  /** Every sampled area has usable current data; required for automatic defaults. */
  readonly exposureVerified?: boolean;
  /** Approximate route lengths through current elevated/higher risk and unknown coverage. */
  readonly exposureDistanceM?: number;
  readonly higherRiskDistanceM?: number;
  readonly unknownDistanceM?: number;
}

/** A comparison entry: a candidate + its risk summary + recommendation. */
export interface RouteOption {
  readonly candidate: RouteCandidate;
  readonly risk: RouteRiskSummary;
  /** Recommendation label. */
  readonly recommendation:
    | 'recommended'
    | 'lowerRiskAlternative'
    | 'higherFloodExposure'
    | 'alternative'
    | 'unavailable';
  /** Concise, decision-focused bullets. Never says "safe". */
  readonly reasons: readonly RouteReason[];
  /** Distance/exposure description of this suggestion, based on current signals. */
  readonly suggestion?: string;
  readonly comparison?: {
    readonly referenceLabel: string;
    readonly sharedPathPercent: number;
    readonly differentDistanceM: number;
    readonly extraDurationS: number;
    readonly extraDistanceM: number;
    readonly sameFloodAssessment: boolean;
  };
}

/**
 * The signals the caller injects so route risk reflects LIVE state. All are
 * optional; missing signals degrade to data-quality-safe defaults.
 */
export interface RoutePlanningContext {
  /** PSGC → live current-risk level (from the barangay risk controller). */
  readonly riskByBarangay?: (psgc: string) => CurrentRiskLevel | undefined;
  /** PSGC → recent community report count. */
  readonly reportCountByBarangay?: (psgc: string) => number;
  /**
   * PSGC → count of ACTIVE AI web-evidence items resolving to the barangay.
   * Supporting context only — never produces a closure or raises risk level.
   */
  readonly webEvidenceCountByBarangay?: (psgc: string) => number;
  /** PSGC set of confirmed closures. */
  readonly closedBarangays?: ReadonlySet<string>;
  /** Current rainfall trend (from the rainfall snapshot). */
  readonly trend?: RainfallTrend;
  /** True when live rainfall/current-risk data is unavailable/stale. */
  readonly dataUnavailable?: boolean;
  /** Reference time (epoch seconds). */
  readonly now?: number;
}

/** Distance between route samples when aggregating risk (meters). */
const SAMPLE_INTERVAL_M = 250;

/** Only reuse the offline demo at its endpoints, never for nearby pinned journeys. */
function near(a: readonly [number, number], b: readonly [number, number]): boolean {
  return distanceMeters([a[0], a[1]], [b[0], b[1]]) < 30;
}

const PITX: readonly [number, number] = PITX_TO_MOA_ROUTE[0];
const MOA: readonly [number, number] = PITX_TO_MOA_ROUTE[PITX_TO_MOA_ROUTE.length - 1];

/** Join a bundled road reroute to the original road prefix from PITX. */
function bundledAlternative(hazardId: string, id: string, label: string): RouteCandidate | null {
  const alt = PITX_TO_MOA_REROUTES.find((r) => r.hazardId === hazardId);
  if (!alt) return null;
  const original = measureRoute(PITX_TO_MOA_ROUTE);
  const prefix = original.points.filter((_, i) => original.cumulative[i] < alt.fromM);
  const prefixLength = measureRoute([...prefix, alt.route[0]]).length;
  const route = [...prefix, ...alt.route];
  const measured = measureRoute(route);
  return {
    id, label, route,
    maneuvers: [
      ...PITX_TO_MOA_MANEUVERS.filter((m) => m.atM < alt.fromM && m.type !== 'arrive'),
      ...alt.maneuvers.filter((m) => m.type !== 'depart').map((m) => ({ ...m, atM: m.atM + prefixLength })),
    ],
    distanceM: measured.length,
    durationS: SIM_SPEED_MPS > 0 ? measured.length / SIM_SPEED_MPS : 0,
    // Later detours still cross earlier demo hazards on the original prefix.
    hazards: PITX_TO_MOA_HAZARDS.filter((h) => h.atM < alt.fromM),
  };
}

/** Options for {@link planRoutes} (Directions token + injectable fetch). */
export interface PlanRoutesOptions {
  /** Mapbox access token (from AppConfig.tileKey) for road-following routing. */
  readonly mapboxToken?: string;
  /** Injectable fetch for the Directions request (tests). */
  readonly fetchImpl?: FetchLike;
  /** Travel mode. Defaults to `drive`. Bike/Walk request cycling/walking. */
  readonly mode?: TravelMode;
  /** Only retain roads satisfying a caller's flood-avoidance constraint. */
  readonly routeFilter?: (route: DirectionsRoute) => boolean;
  readonly excludePoints?: readonly LngLat[];
  /** Additional road-snapped shaping points around a blocked road. */
  readonly avoidanceWaypoints?: readonly LngLat[];
}

/** A short mode-specific label prefix for generated route candidates. */
const MODE_LABEL: Record<TravelMode, string> = {
  drive: 'Driving',
  bike: 'Cycling',
  walk: 'Walking',
};

/** A last-resort straight-line candidate, used only when routing is impossible. */
function straightLineCandidate(
  origin: readonly [number, number],
  destination: readonly [number, number],
): RouteCandidate {
  const line: LngLat[] = [
    [origin[0], origin[1]],
    [destination[0], destination[1]],
  ];
  const measured = measureRoute(line);
  return {
    id: 'direct-line',
    label: 'Direct route',
    route: line,
    maneuvers: [
      { atM: 0, type: 'depart', modifier: null, street: null, instruction: 'Head toward destination.' },
      { atM: Math.round(measured.length), type: 'arrive', modifier: null, street: null, instruction: 'Arrive at destination.' },
    ],
    distanceM: measured.length,
    durationS: SIM_SPEED_MPS > 0 ? measured.length / SIM_SPEED_MPS : 0,
    hazards: [],
  };
}

/** Reject nearly identical road corridors even with different vertex sampling. */
function samePath(a: DirectionsRoute, b: DirectionsRoute): boolean {
  return !compareRoutePaths(a.geometry, b.geometry).meaningful;
}

/** Find three actual road paths; never duplicate a route to fill the second card. */
async function findDistinctRoutes(
  origin: LngLat, destination: LngLat, options: PlanRoutesOptions,
): Promise<DirectionsRoute[]> {
  const request = (via?: LngLat) => fetchDirectionsRoutes(
    origin, destination, options.mapboxToken ?? '',
    { mode: options.mode, alternatives: !via, via, fetchImpl: options.fetchImpl,
      signal: AbortSignal.timeout(10000), excludePoints: options.excludePoints },
  );
  const routes: DirectionsRoute[] = [];
  const add = (candidates: DirectionsRoute[]) => {
    for (const candidate of candidates) {
      if (routes.length >= 3) break;
      if ((!options.routeFilter || options.routeFilter(candidate)) && isUsableRouteGeometry(candidate.geometry) && !routes.some((route) => samePath(route, candidate))) routes.push(candidate);
    }
  };
  const initial = await request();
  add(initial);
  // Do not multiply failing network requests or search a zero-length journey.
  if ((initial.length === 0 && !options.avoidanceWaypoints?.length) || routes.length >= 3 || distanceMeters(origin, destination) < 50) return routes;
  // Point exclusions can return NoRoute even when a nearby road detour exists.
  // Try local corridors around the flood before the wider journey-midpoint search.
  const waypoints = options.avoidanceWaypoints ?? [];
  for (let i = 0; i < waypoints.length; i += 2) {
    const results = await Promise.all(waypoints.slice(i, i + 2).map((via) => request(via)));
    for (const result of results) add(result);
    if (routes.length >= 3) return routes;
  }
  const latitude = (origin[1] + destination[1]) / 2;
  const lngScale = Math.cos(latitude * Math.PI / 180);
  const dx = (destination[0] - origin[0]) * lngScale;
  const dy = destination[1] - origin[1];
  const length = Math.hypot(dx, dy);
  const offset = Math.min(0.015, Math.max(0.003, length * 0.2));
  for (const factor of [1, 2]) {
    const results = await Promise.all([-1, 1].map((side) => request([
      (origin[0] + destination[0]) / 2 - dy / length * offset * factor * side / lngScale,
      latitude + dx / length * offset * factor * side,
    ])));
    for (const result of results) add(result);
    if (routes.length >= 3) break;
  }
  return routes;
}

/**
 * Returns drivable candidate routes for an origin/destination pair.
 *
 * The flagship PITX→MOA pair yields the bundled REAL route + its flood-avoiding
 * alternative (offline, demo-reliable). Any other NCR pair is routed via the
 * Mapbox Directions API so the candidate follows real road geometry — the same
 * LineString the simulator drives and the map draws, so the vehicle never cuts
 * across buildings. Only if routing is unavailable (no token / network error)
 * does it fall back to a single straight-line candidate; even then the drawn
 * line and the simulated path share that one geometry. When only one distinct
 * provider path exists, the comparison panel explains the missing alternative.
 */
async function planRouteCandidates(
  origin: readonly [number, number],
  destination: readonly [number, number],
  options: PlanRoutesOptions = {},
): Promise<RouteCandidate[]> {
  const mode: TravelMode = options.mode ?? 'drive';
  const isPitxMoa =
    near(origin, PITX) && near(destination, MOA);

  // The bundled PITX→MOA demo geometry is DRIVING geometry with demo hazards;
  // it must NOT be reused for cycling/walking (spec: never reuse driving
  // geometry for other modes). So it only applies to drive mode.
  if (isPitxMoa && mode === 'drive') {
    const measured = measureRoute(PITX_TO_MOA_ROUTE);
    const primary: RouteCandidate = {
      id: 'pitx-moa-primary',
      label: 'Route A — direct',
      route: PITX_TO_MOA_ROUTE,
      maneuvers: PITX_TO_MOA_MANEUVERS,
      distanceM: measured.length,
      durationS: SIM_SPEED_MPS > 0 ? measured.length / SIM_SPEED_MPS : 0,
      hazards: PITX_TO_MOA_HAZARDS,
    };
    const alt = bundledAlternative('demo-roxas-baclaran', 'pitx-moa-lowrisk', 'Route B — flood-avoiding');
    const longer = bundledAlternative('demo-edsa-extension', 'pitx-moa-longer', 'Route C — later detour');
    return [primary, alt, longer].filter((route): route is RouteCandidate => route !== null);
  }

  // Generic pair (or non-drive mode): obtain REAL path-following routes from the
  // Mapbox Directions profile for this mode, asking for ALTERNATIVES so the user
  // can compare three distinct provider routes. Geometry is never shared across modes.
  const routed = await findDistinctRoutes(
    [origin[0], origin[1]], [destination[0], destination[1]], { ...options, mode },
  );
  if (routed.length > 0) {
    return routed.map((r, i) => ({
      id: i === 0 ? `${mode}-route` : `${mode}-route-alt${i}`,
      label: i === 0 ? `${MODE_LABEL[mode]} route A` : `${MODE_LABEL[mode]} route ${String.fromCharCode(65 + i)}`,
      route: r.geometry,
      maneuvers: r.maneuvers,
      distanceM: r.distanceM,
      // Prefer the provider's duration when present; else derive from sim speed
      // (a coarse fallback used only when the provider omits duration).
      durationS:
        r.durationS > 0
          ? r.durationS
          : SIM_SPEED_MPS > 0
            ? r.distanceM / SIM_SPEED_MPS
            : 0,
      hazards: [],
    }));
  }

  // Last resort only when routing is impossible (no token / network error): a
  // single straight-line candidate so the flow still completes. Not a fake
  // "alternative" — it is the sole candidate.
  return [straightLineCandidate(origin, destination)];
}

/** Distribute the two journey demos across different route options. */
export async function planRoutes(
  origin: readonly [number, number],
  destination: readonly [number, number],
  options: PlanRoutesOptions = {},
): Promise<RouteCandidate[]> {
  const candidates = await planRouteCandidates(origin, destination, options);
  return assignRouteFloodDemos(candidates).map((candidate) => {
    if (candidate.id !== 'pitx-moa-lowrisk') return candidate;
    // This verified road point is on Route B's earlier turn-off, >=50 m from
    // the later flood-avoiding turn-off. A midpoint demo blocked every bundled
    // alternative because they all rejoined that same road.
    return { ...candidate, demoFloods: createRouteFloodDemo(candidate.route, candidate.maneuvers,
      'passable', [{ id: 'demo-route-passable', atM: 2400, state: 'YELLOW',
        street: [...candidate.maneuvers].reverse().find((m) => m.atM <= 2400 && m.street)?.street ?? 'Route B' }]) };
  });
}

/**
 * True when a route must be BLOCKED from Start because it passes through a
 * confirmed closure (not passable). Preserves the existing closure semantics:
 * a confirmed closure is authoritative. Data-quality/other states never block.
 */
export function isRouteStartBlocked(option: RouteOption): boolean {
  return option.risk.closureCount > 0;
}

/** Maps a demo hazard's reported state to a current-risk level. */
function hazardToRisk(state: DriveHazard['state']): CurrentRiskLevel {
  switch (state) {
    case 'RED':
      return 'REPORTED_FLOODING';
    case 'ORANGE':
      return 'HIGH';
    case 'YELLOW':
    default:
      return 'ELEVATED';
  }
}

/** Returns the more severe of two levels, ignoring data-quality states. */
function maxLevel(a: CurrentRiskLevel, b: CurrentRiskLevel): CurrentRiskLevel {
  if (isDataQualityState(a)) return b;
  if (isDataQualityState(b)) return a;
  return riskSeverity(a) >= riskSeverity(b) ? a : b;
}

/**
 * Aggregates a route's flood-risk summary from the injected live signals. The
 * route geometry is sampled every {@link SAMPLE_INTERVAL_M}; each sample resolves
 * to a barangay whose current risk, reports, and closure status contribute.
 * Demo hazards on the route contribute their mapped risk. UNKNOWN/STALE never
 * count as LOW: if NO sample produced a classified level, the summary is
 * data-unavailable.
 */
export function summarizeRouteRisk(
  candidate: RouteCandidate,
  ctx: RoutePlanningContext = {},
): RouteRiskSummary {
  const measured = measureRoute(candidate.route);
  const barangays = new Set<string>();
  let coverageMissing = false;
  for (let m = 0; m <= measured.length; m += SAMPLE_INTERVAL_M) {
    const pt = pointAlongSafe(measured.points, measured.cumulative, m);
    const psgc = resolveBarangayForPoint(pt[0], pt[1]);
    if (psgc) barangays.add(psgc);
    else coverageMissing = true;
    const middle = pointAlongSafe(measured.points, measured.cumulative, Math.min(measured.length, m + SAMPLE_INTERVAL_M / 2));
    const middleBarangay = resolveBarangayForPoint(middle[0], middle[1]);
    if (middleBarangay) barangays.add(middleBarangay);
    else coverageMissing = true;
  }

  const endpoint = candidate.route[candidate.route.length - 1];
  const endpointBarangay = endpoint && resolveBarangayForPoint(endpoint[0], endpoint[1]);
  if (endpointBarangay) barangays.add(endpointBarangay);
  else coverageMissing = true;

  let level: CurrentRiskLevel = 'LOW';
  let sawClassified = false;
  let higherRiskSegments = 0;
  let reportCount = 0;
  let webEvidenceCount = 0;
  let closureCount = 0;

  for (const psgc of barangays) {
    if (ctx.closedBarangays?.has(psgc)) {
      closureCount += 1;
      level = maxLevel(level, 'CONFIRMED_NOT_PASSABLE');
      sawClassified = true;
    }
    const bRisk = ctx.riskByBarangay?.(psgc);
    if (!bRisk || isDataQualityState(bRisk)) coverageMissing = true;
    if (bRisk && !isDataQualityState(bRisk)) {
      sawClassified = true;
      level = maxLevel(level, bRisk);
      if (riskSeverity(bRisk) >= riskSeverity('HIGH')) higherRiskSegments += 1;
    }
    reportCount += ctx.reportCountByBarangay?.(psgc) ?? 0;
    // Web evidence is SUPPORTING context: it is counted but never raises
    // `level` and never flags `sawClassified` on its own (a single AI/news
    // result must not classify or block a route).
    webEvidenceCount += ctx.webEvidenceCountByBarangay?.(psgc) ?? 0;
  }

  // Demo hazards that sit on this route always contribute their mapped risk.
  for (const hz of candidate.hazards) {
    const hzRisk = hazardToRisk(hz.state);
    sawClassified = true;
    level = maxLevel(level, hzRisk);
    if (riskSeverity(hzRisk) >= riskSeverity('HIGH')) higherRiskSegments += 1;
  }

  let exposureDistanceM = 0;
  let higherRiskDistanceM = 0;
  let unknownDistanceM = 0;
  // Measure exposure along the path, rather than comparing only its worst label.
  for (let startM = 0; startM < measured.length; startM += SAMPLE_INTERVAL_M) {
    const endM = Math.min(measured.length, startM + SAMPLE_INTERVAL_M);
    const pt = pointAlongSafe(measured.points, measured.cumulative, (startM + endM) / 2);
    const psgc = resolveBarangayForPoint(pt[0], pt[1]);
    let segmentRisk = psgc ? ctx.riskByBarangay?.(psgc) : undefined;
    if (!segmentRisk || isDataQualityState(segmentRisk) || ctx.dataUnavailable) {
      unknownDistanceM += endM - startM;
      coverageMissing = true;
    }
    if (psgc && ctx.closedBarangays?.has(psgc)) segmentRisk = 'CONFIRMED_NOT_PASSABLE';
    for (const hazard of candidate.hazards) {
      if (hazard.atM >= startM && hazard.atM < endM) segmentRisk = maxLevel(segmentRisk ?? 'UNKNOWN', hazardToRisk(hazard.state));
    }
    if (segmentRisk && !isDataQualityState(segmentRisk)) {
      if (riskSeverity(segmentRisk) >= riskSeverity('ELEVATED')) exposureDistanceM += endM - startM;
      if (riskSeverity(segmentRisk) >= riskSeverity('HIGH')) higherRiskDistanceM += endM - startM;
    }
  }

  // Missing current classifications cannot establish zero flood exposure.
  if (!sawClassified) {
    return {
      level: 'UNKNOWN',
      higherRiskSegments: 0,
      reportCount,
      webEvidenceCount,
      closureCount,
      trend: ctx.trend ?? 'unknown',
      dataUnavailable: true,
      exposureVerified: false,
      exposureDistanceM, higherRiskDistanceM, unknownDistanceM,
    };
  }

  return {
    level,
    higherRiskSegments,
    reportCount,
    webEvidenceCount,
    closureCount,
    trend: ctx.trend ?? 'unknown',
    dataUnavailable: false,
    exposureVerified: !ctx.dataUnavailable && !coverageMissing,
    exposureDistanceM, higherRiskDistanceM, unknownDistanceM,
  };
}

/** Local pointAlong that avoids importing the throwing variant for empty guards. */
function pointAlongSafe(
  points: ReadonlyArray<LngLat>,
  cumulative: number[],
  meters: number,
): LngLat {
  if (points.length === 0) return [0, 0];
  if (meters <= 0) return points[0];
  const length = cumulative[cumulative.length - 1] ?? 0;
  if (meters >= length) return points[points.length - 1];
  let lo = 0;
  let hi = cumulative.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= meters) lo = mid;
    else hi = mid;
  }
  const segLen = cumulative[hi] - cumulative[lo] || 1;
  const t = (meters - cumulative[lo]) / segLen;
  const a = points[lo];
  const b = points[hi];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Whether a reported-flooding signal is present (REPORTED_FLOODING level). */
function hasReportedFlooding(r: RouteRiskSummary): boolean {
  return r.level === 'REPORTED_FLOODING';
}

/** LOW alone is insufficient when reports, closures, or missing data remain. */
export function hasNoDetectedFloodExposure(risk: RouteRiskSummary): boolean {
  return !risk.dataUnavailable && risk.exposureVerified !== false && risk.level === 'LOW' && risk.closureCount === 0 &&
    risk.reportCount === 0 && risk.higherRiskSegments === 0;
}

/** Only verified, usable directions with zero detected exposure may be defaults. */
export function isDefaultRouteEligible(option: Pick<RouteOption, 'candidate' | 'risk'>): boolean {
  const { candidate, risk } = option;
  return risk.exposureVerified === true && hasNoDetectedFloodExposure(risk) && candidate.hazards.length === 0 &&
    candidate.id !== 'direct-line' && candidate.route.length >= 2 &&
    candidate.route.every(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat)) &&
    Number.isFinite(candidate.durationS) && candidate.durationS > 0 &&
    Number.isFinite(candidate.distanceM) && candidate.distanceM > 0;
}

/** ETA and travel time share durationS; distance breaks equal-time ties. */
export function getValidatedDefaultRoute(options: readonly RouteOption[]): RouteOption | null {
  return [...options].filter(isDefaultRouteEligible).sort((a, b) =>
    a.candidate.durationS - b.candidate.durationS || a.candidate.distanceM - b.candidate.distanceM,
  )[0] ?? null;
}

/** Route B is a selection fallback only; it does not gain a recommendation. */
export function getInitialRouteSelection(options: readonly RouteOption[]): RouteOption | null {
  // An available recommendation always takes priority over the Route B fallback.
  const recommended = options.filter((option) => option.recommendation === 'recommended');
  const validated = getValidatedDefaultRoute(recommended) ?? getValidatedDefaultRoute(options);
  if (validated) return validated;
  return options.find(({ candidate }) =>
    candidate.id === 'pitx-moa-lowrisk' || /-route-alt1$/.test(candidate.id) ||
    /\broute b\b/i.test(candidate.label),
  ) ?? null;
}

/**
 * A preference-aware comparison score (LOWER is better). It only REORDERS the
 * provider's routes; it never changes geometry or invents routes.
 *
 * `lowerFloodExposure` (default) ranks primarily by flood exposure:
 *   1. confirmed closures  2. reported flooding  3. predicted flood-risk
 *   exposure (severity)  4. number of higher-risk segments  5. distance.
 *
 * `faster` ranks primarily by travel time, but confirmed closures are STILL
 * avoided (heaviest weight) and exposure remains a secondary factor:
 *   1. confirmed closures (still avoided)  2. travel time  3. predicted exposure.
 *
 * Data-quality states (UNKNOWN/STALE) get a mild uncertainty penalty — never
 * treated as LOW/safe.
 */
function preferenceScore(
  option: { candidate: RouteCandidate; risk: RouteRiskSummary },
  preference: RoutePreference,
): number {
  const timeMin = option.candidate.durationS / 60;
  const r = option.risk;
  const severity = isDataQualityState(r.level) ? 2.5 : riskSeverity(r.level);
  // Confirmed closures dominate BOTH preferences so a closed route never wins.
  const closurePenalty = r.closureCount * 1000;
  const reported = hasReportedFlooding(r) ? 1 : 0;

  // Web evidence is a MILD supporting nudge only — weighted far below reports
  // and nowhere near the closure penalty, so a single AI/news result can never
  // dominate ranking or block a route.
  const webNudge = r.webEvidenceCount * 0.5;

  if (preference === 'faster') {
    // Time-first; exposure is a lighter secondary term.
    const exposure = severity * 1.5 + r.higherRiskSegments * 1 + reported * 4;
    return closurePenalty + timeMin + exposure + webNudge;
  }
  // lowerFloodExposure: exposure-first, time is the final tie-breaker.
  const exposure =
    reported * 40 + severity * 8 + r.higherRiskSegments * 4 + r.reportCount * 1.5;
  return closurePenalty + exposure + webNudge + timeMin * 0.25;
}

/** Compare current evidence, not historical susceptibility or travel time. */
export function sameRouteFloodAssessment(a: RouteOption, b: RouteOption): boolean {
  const first = a.risk;
  const second = b.risk;
  const ratio = (meters: number | undefined, option: RouteOption) => (meters ?? 0) / measureRoute(option.candidate.route).length;
  return first.level === second.level && first.dataUnavailable === second.dataUnavailable &&
    first.exposureVerified === second.exposureVerified && first.closureCount === second.closureCount &&
    first.reportCount === second.reportCount &&
    Math.abs((first.exposureDistanceM ?? 0) - (second.exposureDistanceM ?? 0)) < 250 &&
    Math.abs((first.higherRiskDistanceM ?? 0) - (second.higherRiskDistanceM ?? 0)) < 250 &&
    Math.abs(ratio(first.exposureDistanceM, a) - ratio(second.exposureDistanceM, b)) < 0.02 &&
    Math.abs(ratio(first.unknownDistanceM, a) - ratio(second.unknownDistanceM, b)) < 0.02;
}

/**
 * Builds the compared, recommendation-labeled route options. The recommended
 * default has verified zero detected exposure and the shortest travel time.
 * If none qualifies, alternatives remain visible without an automatic default.
 * Labels: the winner is "Recommended"; a clearly lower-risk-but-present option
 * is "Lower-risk alternative"; a faster-but-riskier option is "Higher flood
 * exposure"; the rest are "Alternative". Routes with no usable current data are
 * labeled "unavailable".
 */
export function compareRoutes(
  candidates: readonly RouteCandidate[],
  ctx: RoutePlanningContext = {},
  preference: RoutePreference = 'lowerFloodExposure',
): RouteOption[] {
  const scored = candidates.filter((candidate) => isUsableRouteGeometry(candidate.route)).map((candidate) => {
    const risk = summarizeRouteRisk(candidate, ctx);
    return { candidate, risk, score: preferenceScore({ candidate, risk }, preference) };
  });
  if (scored.length === 0) return [];

  // Preferences order alternatives; default validation applies in every mode.
  const sorted = [...scored].sort((a, b) => {
    if (preference === 'faster') return a.score - b.score;
    // Closures always come last. Prefer the shortest route with no detected
    // exposure; otherwise use the least exposed available route, then distance.
    const closure = a.risk.closureCount - b.risk.closureCount;
    if (closure) return closure;
    const clean = Number(hasNoDetectedFloodExposure(b.risk)) - Number(hasNoDetectedFloodExposure(a.risk));
    if (clean) return clean;
    if (!hasNoDetectedFloodExposure(a.risk)) {
      const severity = (isDataQualityState(a.risk.level) ? 2.5 : riskSeverity(a.risk.level)) -
        (isDataQualityState(b.risk.level) ? 2.5 : riskSeverity(b.risk.level));
      if (severity) return severity;
      const exposure = (a.risk.exposureDistanceM ?? 0) - (b.risk.exposureDistanceM ?? 0);
      if (exposure) return exposure;
      const segments = a.risk.higherRiskSegments - b.risk.higherRiskSegments;
      if (segments) return segments;
    }
    return a.candidate.distanceM - b.candidate.distanceM || a.candidate.durationS - b.candidate.durationS;
  });
  const eligible = scored.filter(isDefaultRouteEligible).sort((a, b) =>
    a.candidate.durationS - b.candidate.durationS || a.candidate.distanceM - b.candidate.distanceM,
  );
  const validatedDefault = eligible[0];
  // Alternatives remain visible when there is no eligible automatic default.
  const best = validatedDefault ?? sorted[0];

  // Put the recommended route first so cards, map, and Start share the default.
  // All suggestions must differ from every other suggestion, including fixtures.
  const distinct = [best];
  for (const item of sorted) {
    if (distinct.some((other) => other.candidate.id === item.candidate.id ||
      !compareRoutePaths(other.candidate.route, item.candidate.route).meaningful)) continue;
    distinct.push(item);
  }
  const remaining = distinct.filter((s) => s !== best).sort((a, b) => a.candidate.distanceM - b.candidate.distanceM);
  const short = remaining.find((s) => !hasNoDetectedFloodExposure(s.risk)) ?? remaining[0];
  const others = remaining.filter((s) => s !== short);
  const long = [...others].reverse().find((s) => !hasNoDetectedFloodExposure(s.risk)) ?? others[others.length - 1];
  const suggestions = [best, short, long].filter((s): s is typeof best => s != null);
  const options: RouteOption[] = suggestions.map((s, index) => {
    const hasClosure = s.risk.closureCount > 0;
    const isBest = s.candidate.id === best.candidate.id;
    let recommendation: RouteOption['recommendation'];
    if (s.risk.dataUnavailable) {
      recommendation = 'unavailable';
    } else if (hasClosure) {
      // Never "recommended". A closed route is an alternative the UI flags +
      // blocks from Start, regardless of how fast it is.
      recommendation = 'alternative';
    } else if (isBest && validatedDefault) {
      recommendation = 'recommended';
    } else if (riskSeverity(s.risk.level) < riskSeverity(best.risk.level)) {
      recommendation = 'lowerRiskAlternative';
    } else if (
      s.candidate.durationS < best.candidate.durationS &&
      riskSeverity(s.risk.level) > riskSeverity(best.risk.level)
    ) {
      recommendation = 'higherFloodExposure';
    } else {
      recommendation = 'alternative';
    }
    return {
      candidate: s.candidate,
      risk: s.risk,
      recommendation,
      suggestion: s.risk.dataUnavailable || isDataQualityState(s.risk.level) || (s.risk.level === 'LOW' && !s.risk.exposureVerified)
        ? 'Flood exposure unknown'
        : hasNoDetectedFloodExposure(s.risk)
          ? (isBest && validatedDefault ? 'Shortest ETA / travel time · No detected flood exposure' : 'No detected flood exposure')
          : `${index === 2 && short && s.candidate.distanceM > short.candidate.distanceM ? 'Longer route' : 'Shorter route'} · ${s.risk.level === 'ELEVATED' ? 'Minimal flood exposure' : 'Flood exposure'}`,
      reasons: [
        ...(isBest && validatedDefault ? [{ key: 'time', text: 'Shortest ETA and travel time among routes with no detected flood exposure' }] : []),
        ...buildReasons(s.risk, recommendation, preference),
      ],
    };
  });
  const reference = options[0];
  return options.map((option, i) => {
    if (i === 0) return option;
    const sameFloodAssessment = sameRouteFloodAssessment(option, reference);
    const overlap = compareRoutePaths(option.candidate.route, reference.candidate.route);
    return {
      ...option,
      suggestion: sameFloodAssessment ? (option.risk.exposureVerified ? 'Different roads · Same current flood assessment' : 'Different roads · Flood exposure not fully verified') : option.suggestion,
      comparison: {
        referenceLabel: reference.candidate.label,
        sharedPathPercent: overlap.sharedPathPercent,
        differentDistanceM: overlap.differentDistanceM,
        extraDurationS: option.candidate.durationS - reference.candidate.durationS,
        extraDistanceM: option.candidate.distanceM - reference.candidate.distanceM,
        sameFloodAssessment,
      },
      reasons: [
        ...option.reasons,
        ...(sameFloodAssessment ? [{ key: 'equalExposure', text: `No measured flood advantage over ${reference.candidate.label}; an alternative road corridor` }] : []),
      ],
    };
  });
}

/**
 * Builds concise, decision-focused "Why this route?" bullets from REAL route
 * data only (never invented, never "safe"). Recommended-route wording reflects
 * the active preference: `faster` leads with travel time; `lowerFloodExposure`
 * leads with flood exposure.
 */
function buildReasons(
  risk: RouteRiskSummary,
  recommendation: RouteOption['recommendation'],
  preference: RoutePreference = 'lowerFloodExposure',
): RouteReason[] {
  const out: RouteReason[] = [];
  if (recommendation === 'unavailable' || risk.dataUnavailable) {
    out.push({ key: 'noData', text: 'Current flood information unavailable' });
    return out;
  }
  if (risk.closureCount > 0) {
    out.push({
      key: 'closure',
      text: `${risk.closureCount} confirmed closure${risk.closureCount === 1 ? '' : 's'} on this route`,
    });
  }
  if (recommendation === 'recommended') {
    if (preference === 'faster') {
      out.push({ key: 'time', text: 'Shortest estimated travel time' });
      if (risk.closureCount === 0) {
        out.push({ key: 'noClosure', text: 'No confirmed closures' });
      }
      out.push({
        key: 'exposureThreshold',
        text: 'Flood exposure remains within the current route threshold',
      });
    } else {
      out.push({ key: 'exposure', text: 'Lower predicted flood exposure' });
      if (risk.higherRiskSegments === 0) {
        out.push({ key: 'segments', text: 'Avoids higher-risk segments' });
      }
      if (risk.closureCount === 0) {
        out.push({ key: 'noClosure', text: 'No confirmed closures' });
      }
    }
  } else if (recommendation === 'lowerRiskAlternative') {
    out.push({ key: 'exposure', text: 'Lower predicted flood exposure' });
    if (risk.higherRiskSegments === 0) {
      out.push({ key: 'segments', text: 'Avoids higher-risk segments' });
    }
    if (risk.closureCount === 0) {
      out.push({ key: 'noClosure', text: 'No confirmed closures' });
    }
  } else {
    if (risk.higherRiskSegments > 0) {
      out.push({
        key: 'segments',
        text: `Crosses ${risk.higherRiskSegments} higher-risk segment${risk.higherRiskSegments === 1 ? '' : 's'}`,
      });
    }
    if (risk.reportCount > 0) {
      out.push({
        key: 'reports',
        text: `${risk.reportCount} recent community report${risk.reportCount === 1 ? '' : 's'} (unconfirmed)`,
      });
    }
    if (risk.webEvidenceCount > 0) {
      out.push({
        key: 'webEvidence',
        text: 'Recent flood evidence was found near one route segment (web, unofficial)',
      });
    }
  }
  return out;
}

/**
 * A short, decision-focused explanation of a route's flood-risk makeup, built
 * ONLY from the already-computed {@link RouteRiskSummary}. This adds no new
 * segmentation engine and makes no depth/vehicle-clearance claims — it just
 * reads back the existing per-route signals in plain language so a commuter
 * understands WHY a route carries its flood-risk context. Never says "safe".
 *
 * Precedence mirrors the risk semantics: confirmed closures first, then
 * reported flooding, then higher-risk segments, then community reports, then a
 * data-quality note. Returns a neutral line when there is nothing notable.
 */
export function routeSegmentExplanation(risk: RouteRiskSummary): string {
  if (risk.dataUnavailable) {
    return 'Current flood information unavailable for this route.';
  }
  const parts: string[] = [];
  if (risk.closureCount > 0) {
    parts.push(
      `${risk.closureCount} confirmed closure${risk.closureCount === 1 ? '' : 's'} (not passable)`,
    );
  }
  if (risk.level === 'REPORTED_FLOODING') {
    parts.push('active flooding reported along the way');
  }
  if (risk.higherRiskSegments > 0) {
    parts.push(
      `${risk.higherRiskSegments} higher-risk segment${risk.higherRiskSegments === 1 ? '' : 's'}`,
    );
  }
  if (risk.reportCount > 0) {
    parts.push(
      `${risk.reportCount} recent community report${risk.reportCount === 1 ? '' : 's'} (unconfirmed)`,
    );
  }
  if (risk.webEvidenceCount > 0) {
    parts.push(
      `recent flood evidence found near ${risk.webEvidenceCount === 1 ? 'one route segment' : `${risk.webEvidenceCount} route segments`} (web, unofficial)`,
    );
  }
  if (parts.length === 0) {
    return 'No higher-risk segments, closures, or recent reports on this route.';
  }
  // Capitalize the first word for a clean sentence; join the rest with commas.
  const sentence = parts.join(', ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}
