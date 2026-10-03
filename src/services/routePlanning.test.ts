// src/services/routePlanning.test.ts
//
// Flood-aware route planning + comparison. Verifies: the flagship PITX→MOA pair
// yields the bundled real route + its flood-avoiding alternative (offline); a
// generic NCR pair is routed via Mapbox Directions (road-following) and falls
// back to a straight line only when routing is unavailable; risk aggregation
// respects the flood semantics (UNKNOWN/STALE never treated as LOW; closures
// are the strongest signal; demo hazards contribute); the recommendation is
// balanced (not merely fastest); and "Why this route?" never uses banned
// safety language.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as resolution from './reportResolution';
import {
  planRoutes,
  summarizeRouteRisk,
  compareRoutes,
  isRouteStartBlocked,
  getValidatedDefaultRoute,
  getInitialRouteSelection,
  sameRouteFloodAssessment,
  isDefaultRouteEligible,
  type RouteCandidate,
} from './routePlanning';
import type { FetchLike } from './directions';
import type { DriveHazard } from '../data/fixtures/driveHazards';
import { PITX_TO_MOA_ROUTE } from '../data/fixtures/pitxToMoaRoute';
import type { CurrentRiskLevel } from '../types/risk';

// Route-ranking tests inject complete geographic coverage; missing coverage
// is exercised separately below rather than relying on the small demo dataset.
beforeEach(() => { vi.spyOn(resolution, 'resolveBarangayForPoint').mockReturnValue('test-barangay'); });
afterEach(() => vi.restoreAllMocks());

const PITX = PITX_TO_MOA_ROUTE[0];
const MOA = PITX_TO_MOA_ROUTE[PITX_TO_MOA_ROUTE.length - 1];

/** A fake Directions response with a small multi-vertex (road-like) line. */
const ROADLIKE: [number, number][] = [
  [121.0, 14.6],
  [121.02, 14.605],
  [121.03, 14.612],
  [121.05, 14.62],
];
const okFetch: FetchLike = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    code: 'Ok',
    routes: [
      {
        distance: 3000,
        duration: 600,
        geometry: { type: 'LineString', coordinates: ROADLIKE },
        legs: [
          {
            steps: [
              { distance: 1500, name: 'A St', maneuver: { type: 'depart', instruction: 'Go' } },
              { distance: 1500, name: 'B St', maneuver: { type: 'turn', modifier: 'left', instruction: 'Turn left' } },
              { distance: 0, name: '', maneuver: { type: 'arrive', instruction: 'Arrive' } },
            ],
          },
        ],
      },
    ],
  }),
});
/** A fetch that always fails, forcing the straight-line fallback. */
const failFetch: FetchLike = async () => ({ ok: false, status: 500, json: async () => ({}) });

/** A generic road-following candidate (via the fake Directions fetch). */
async function genericCandidate(): Promise<RouteCandidate> {
  const routes = await planRoutes([121.0, 14.6], [121.05, 14.62], {
    mapboxToken: 't',
    fetchImpl: okFetch,
  });
  return routes[0];
}

describe('planRoutes', () => {
  it('returns the real route + flood-avoiding alternative for PITX→MOA', async () => {
    const routes = await planRoutes(PITX, MOA);
    expect(routes.length).toBe(3);
    expect(routes[0].id).toBe('pitx-moa-primary');
    expect(routes[1].id).toBe('pitx-moa-lowrisk');
    expect(routes[0].hazards.length).toBeGreaterThan(0);
    expect(routes[1].hazards.length).toBe(0);
    expect(routes[2].id).toBe('pitx-moa-longer');
    expect(routes[2].hazards.length).toBeGreaterThan(0);
    expect(routes[2].distanceM).toBeGreaterThan(routes[0].distanceM);
    for (const route of routes) {
      expect(route.route[0]).toEqual(PITX);
      expect(route.route[route.route.length - 1]).toEqual(MOA);
    }
  });

  it('does not reuse forward-only geometry when the demo endpoints are reversed', async () => {
    const routes = await planRoutes(MOA, PITX);
    expect(routes[0].route[0]).toEqual(MOA);
    expect(routes[0].route[routes[0].route.length - 1]).toEqual(PITX);
    expect(routes[0].demoFloods).toHaveLength(1);
  });

  it('routes a generic NCR pair via Directions (real road geometry)', async () => {
    const routes = await planRoutes([121.0, 14.6], [121.05, 14.62], {
      mapboxToken: 't',
      fetchImpl: okFetch,
    });
    expect(routes.length).toBe(1);
    expect(routes[0].id).toBe('drive-route');
    // A road-following line has more than two vertices (not a straight line).
    expect(routes[0].route.length).toBeGreaterThan(2);
    expect(routes[0].maneuvers.length).toBeGreaterThan(0);
  });

  it('searches waypoint routes when alternatives repeat the same path', async () => {
    const urls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      urls.push(url);
      if (!url.includes('waypoints=')) return okFetch(url);
      return { ok: true, status: 200, json: async () => ({ code: 'Ok', routes: [{
        duration: 780,
        geometry: { type: 'LineString', coordinates: [ROADLIKE[0], [121.02, 14.62], ROADLIKE[3]] },
        legs: [],
      }] }) };
    };
    const routes = await planRoutes(ROADLIKE[0], ROADLIKE[3], { mapboxToken: 't', fetchImpl });
    expect(routes).toHaveLength(2);
    expect(routes[0].route).not.toEqual(routes[1].route);
    expect(urls).toHaveLength(5);
    expect(urls[1]).toContain('waypoints=0%3B2');
  });

  it('limits choices to three distinct paths and skips duplicate geometries', async () => {
    const fetchImpl: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({
      code: 'Ok', routes: [ROADLIKE, ROADLIKE,
        [ROADLIKE[0], [121.02, 14.62], ROADLIKE[3]],
        [ROADLIKE[0], [121.03, 14.64], ROADLIKE[3]],
      ].map((coordinates) => ({ geometry: { type: 'LineString', coordinates }, legs: [] })),
    }) });
    const routes = await planRoutes(ROADLIKE[0], ROADLIKE[3], { mapboxToken: 't', fetchImpl });
    expect(routes).toHaveLength(3);
    expect(routes[0].route).not.toEqual(routes[1].route);
  });

  it('falls back to a straight line only when routing is unavailable', async () => {
    const routes = await planRoutes([121.0, 14.6], [121.05, 14.62], {
      mapboxToken: 't',
      fetchImpl: failFetch,
    });
    expect(routes.length).toBe(1);
    expect(routes[0].id).toBe('direct-line');
    expect(routes[0].route.length).toBe(2);
  });
});

describe('summarizeRouteRisk — flood semantics', () => {
  it('never reports LOW when data is unavailable and nothing classified', async () => {
    const summary = summarizeRouteRisk(await genericCandidate(), { dataUnavailable: true });
    expect(summary.dataUnavailable).toBe(true);
    expect(summary.level).toBe('UNKNOWN');
    expect(summary.level).not.toBe('LOW');
  });

  it('does not treat a STALE/UNKNOWN barangay level as LOW', async () => {
    const summary = summarizeRouteRisk(await genericCandidate(), {
      riskByBarangay: () => 'STALE' as CurrentRiskLevel,
      dataUnavailable: false,
    });
    expect(summary.higherRiskSegments).toBe(0);
  });

  it('counts a confirmed closure as the strongest signal', async () => {
    const candidate = await genericCandidate();
    const summary = summarizeRouteRisk(candidate, {
      riskByBarangay: () => 'LOW',
      closedBarangays: allResolvedBarangays(candidate),
      dataUnavailable: false,
    });
    expect(summary.closureCount).toBeGreaterThan(0);
    expect(summary.level).toBe('CONFIRMED_NOT_PASSABLE');
  });

  it('escalates for demo hazards on the route (PITX→MOA primary)', async () => {
    const [primary] = await planRoutes(PITX, MOA);
    const summary = summarizeRouteRisk(primary, { dataUnavailable: false, riskByBarangay: () => 'LOW' });
    expect(summary.higherRiskSegments).toBeGreaterThan(0);
    expect(['HIGH', 'LIKELY_FLOODING', 'REPORTED_FLOODING', 'CONFIRMED_NOT_PASSABLE']).toContain(
      summary.level,
    );
  });
});

describe('compareRoutes — recommendation', () => {
  it('recommends the lower-exposure route over the faster-but-hazardous one', async () => {
    const routes = await planRoutes(PITX, MOA);
    const options = compareRoutes(routes, { dataUnavailable: false, riskByBarangay: () => 'LOW' });
    const primary = options.find((o) => o.candidate.id === 'pitx-moa-primary')!;
    const alt = options.find((o) => o.candidate.id === 'pitx-moa-lowrisk')!;
    expect(alt.recommendation).toBe('recommended');
    expect(primary.recommendation).not.toBe('recommended');
  });

  it('labels a route as unavailable when its data is unavailable', async () => {
    const options = compareRoutes([await genericCandidate()], { dataUnavailable: true });
    expect(options[0].recommendation).toBe('unavailable');
  });

  it('never uses banned safety language in the reasons', async () => {
    const options = compareRoutes(await planRoutes(PITX, MOA), { dataUnavailable: false, riskByBarangay: () => 'LOW' });
    const allText = options
      .flatMap((o) => o.reasons.map((r) => r.text.toLowerCase()))
      .join(' ');
    expect(allText).not.toMatch(/\bsafe\b/);
    expect(allText).not.toMatch(/no risk/);
  });
});

describe('travel-mode aware planning', () => {
  it('defaults to drive and returns the bundled PITX→MOA demo (3 routes)', async () => {
    const routes = await planRoutes(PITX, MOA);
    expect(routes.length).toBe(3);
    expect(routes[0].id).toBe('pitx-moa-primary');
  });

  it('does NOT reuse the driving demo geometry for walk/bike (fresh provider request)', async () => {
    const walk = await planRoutes(PITX, MOA, {
      mode: 'walk',
      mapboxToken: 't',
      fetchImpl: okFetch,
    });
    // Walk mode ignores the bundled driving demo and uses the provider route.
    expect(walk[0].id).toBe('walk-route');
    expect(walk[0].id).not.toBe('pitx-moa-primary');
  });

  it('requests the provider for a given mode and maps alternatives', async () => {
    const twoRouteFetch: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        code: 'Ok',
        routes: [
          {
            distance: 3000,
            duration: 600,
            geometry: { type: 'LineString', coordinates: ROADLIKE },
            legs: [{ steps: [{ distance: 3000, name: 'A', maneuver: { type: 'depart' } }] }],
          },
          {
            distance: 3400,
            duration: 720,
            geometry: { type: 'LineString', coordinates: [ROADLIKE[0], [121.02, 14.62], ROADLIKE[3]] },
            legs: [{ steps: [{ distance: 3400, name: 'B', maneuver: { type: 'depart' } }] }],
          },
        ],
      }),
    });
    const bike = await planRoutes([121, 14.6], [121.05, 14.62], {
      mode: 'bike',
      mapboxToken: 't',
      fetchImpl: twoRouteFetch,
    });
    expect(bike.length).toBe(2);
    expect(bike[0].id).toBe('bike-route');
    expect(bike[1].id).toBe('bike-route-alt1');
  });
});

describe('compareRoutes — preference ranking', () => {
  // Two synthetic candidates: A is faster but hazardous, B is slower but clean.
  const line: [number, number][] = [
    [121.0, 14.6],
    [121.05, 14.62],
  ];
  const fast: RouteCandidate = {
    id: 'fast',
    label: 'Fast',
    route: line,
    maneuvers: [],
    distanceM: 3000,
    durationS: 600, // 10 min
    hazards: [{ id: 'h', atM: 500, state: 'ORANGE', street: 'Test St' } satisfies DriveHazard],
  };
  const clean: RouteCandidate = {
    id: 'clean',
    label: 'Clean',
    route: [line[0], [121.01, 14.625], line[1]],
    maneuvers: [],
    distanceM: 5000,
    durationS: 1200, // 20 min, no hazards
    hazards: [],
  };

  it('lowerFloodExposure recommends the cleaner route even if slower', () => {
    const options = compareRoutes([fast, clean], { dataUnavailable: false, riskByBarangay: () => 'LOW' }, 'lowerFloodExposure');
    const rec = options.find((o) => o.recommendation === 'recommended')!;
    expect(rec.candidate.id).toBe('clean');
  });

  it('defaults to the shortest travel time among unexposed routes, ahead of exposed choices', () => {
    const shorterClean = { ...clean, id: 'short-clean', distanceM: 4000, durationS: 1800 };
    const longExposed: RouteCandidate = { ...fast, id: 'long-exposed', route: [line[0], [121.04, 14.585], line[1]], distanceM: 7000, durationS: 1400 };
    const options = compareRoutes([fast, clean, shorterClean, longExposed], { dataUnavailable: false, riskByBarangay: () => 'LOW' });
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.candidate.id)).toEqual(['clean', 'fast', 'long-exposed']);
    expect(options[0].recommendation).toBe('recommended');
    expect(options[0].suggestion).toBe('Shortest ETA / travel time · No detected flood exposure');
    expect(options[1].suggestion).toBe('Shorter route · Flood exposure');
    expect(options[2].suggestion).toBe('Longer route · Flood exposure');
  });

  it('describes minimal exposure and never calls unknown data unexposed', () => {
    const minimal: RouteCandidate = { ...fast, id: 'minimal', route: [line[0], [121.04, 14.585], line[1]], hazards: [{ id: 'm', atM: 500, state: 'YELLOW' as const, street: 'Test' }] };
    const options = compareRoutes([clean, minimal, fast], { dataUnavailable: false, riskByBarangay: () => 'LOW' });
    expect(options[1].suggestion).toContain('Minimal flood exposure');
    const unknown = compareRoutes([clean], { dataUnavailable: true });
    expect(unknown[0].suggestion).toBe('Flood exposure unknown');
    expect(unknown[0].suggestion).not.toContain('No detected');
    expect(compareRoutes([clean])[0].risk.dataUnavailable).toBe(true);
  });

  it('faster still excludes an exposed route from the automatic default', () => {
    const options = compareRoutes([fast, clean], { dataUnavailable: false, riskByBarangay: () => 'LOW' }, 'faster');
    const rec = options.find((o) => o.recommendation === 'recommended')!;
    expect(rec.candidate.id).toBe('clean');
  });

  it('recommended reasons reflect the active preference (faster leads with time)', () => {
    const options = compareRoutes([fast, clean], { dataUnavailable: false, riskByBarangay: () => 'LOW' }, 'faster');
    const rec = options.find((o) => o.recommendation === 'recommended')!;
    const text = rec.reasons.map((r) => r.text.toLowerCase()).join(' ');
    expect(text).toContain('travel time');
  });
});

describe('compareRoutes — confirmed closures are authoritative', () => {
  it('never recommends a route through a confirmed closure, even in faster mode', async () => {
    const candidate = await genericCandidate();
    const closed = allResolvedBarangays(candidate);
    // Only one candidate, and it is closed → it must NOT be recommended.
    const options = compareRoutes([candidate], { closedBarangays: closed }, 'faster');
    expect(options[0].risk.closureCount).toBeGreaterThan(0);
    expect(options[0].recommendation).not.toBe('recommended');
  });

  it('a closed route flags a closure and reasons mention it', async () => {
    const candidate = await genericCandidate();
    const closed = allResolvedBarangays(candidate);
    const options = compareRoutes([candidate], { closedBarangays: closed });
    const text = options[0].reasons.map((r) => r.text.toLowerCase()).join(' ');
    expect(text).toContain('confirmed closure');
  });

  it('isRouteStartBlocked is true only when a confirmed closure is on the route', async () => {
    const candidate = await genericCandidate();
    const openOptions = compareRoutes([candidate], { dataUnavailable: false, riskByBarangay: () => 'LOW' });
    expect(isRouteStartBlocked(openOptions[0])).toBe(false);
    const closedOptions = compareRoutes([candidate], {
      closedBarangays: allResolvedBarangays(candidate),
    });
    expect(isRouteStartBlocked(closedOptions[0])).toBe(true);
  });
});

/** Helper: the set of barangays a candidate's samples resolve to. */
function allResolvedBarangays(candidate: RouteCandidate): Set<string> {
  const set = new Set<string>();
  summarizeRouteRisk(candidate, {
    riskByBarangay: (psgc) => {
      set.add(psgc);
      return 'LOW';
    },
  });
  return set;
}

import { routeSegmentExplanation } from './routePlanning';
import type { RouteRiskSummary } from './routePlanning';

describe('routeSegmentExplanation (reads back the existing summary)', () => {
  const base: RouteRiskSummary = {
    level: 'LOW',
    higherRiskSegments: 0,
    reportCount: 0,
    webEvidenceCount: 0,
    closureCount: 0,
    trend: 'unknown',
    dataUnavailable: false,
  };

  it('reports data unavailable without inventing risk', () => {
    const text = routeSegmentExplanation({ ...base, level: 'UNKNOWN', dataUnavailable: true });
    expect(text.toLowerCase()).toContain('unavailable');
  });

  it('gives a neutral (not "safe") line when nothing is notable', () => {
    const text = routeSegmentExplanation(base);
    expect(text.toLowerCase()).not.toContain('safe');
    expect(text.toLowerCase()).toContain('no higher-risk');
  });

  it('leads with confirmed closures and names higher-risk segments', () => {
    const text = routeSegmentExplanation({
      ...base,
      level: 'CONFIRMED_NOT_PASSABLE',
      closureCount: 1,
      higherRiskSegments: 2,
    });
    expect(text).toContain('1 confirmed closure');
    expect(text).toContain('2 higher-risk segments');
  });

  it('marks community reports as unconfirmed and never says "safe"', () => {
    const text = routeSegmentExplanation({ ...base, reportCount: 3 });
    expect(text).toContain('3 recent community reports');
    expect(text.toLowerCase()).toContain('unconfirmed');
    expect(text.toLowerCase()).not.toContain('safe');
  });
});

// --- Route alternatives share ONE environmental snapshot (no per-route fetch) -

describe('compareRoutes reuses a single shared risk snapshot', () => {
  function candidate(id: string, line: [number, number][]): RouteCandidate {
    return {
      id,
      label: id,
      route: line,
      maneuvers: [],
      distanceM: 3000,
      durationS: 600,
      hazards: [],
    };
  }

  it('analyzes 3 alternatives against the same injected snapshot, never fetching', () => {
    const lineA: [number, number][] = [
      [121.0, 14.6],
      [121.03, 14.62],
    ];
    const lineB: [number, number][] = [
      [121.01, 14.61],
      [121.04, 14.63],
    ];
    const lineC: [number, number][] = [
      [121.02, 14.6],
      [121.05, 14.64],
    ];

    // A fetch that MUST NOT be called by route comparison.
    const fetchSpy = vi.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    let riskCalls = 0;
    try {
      const options = compareRoutes(
        [candidate('A', lineA), candidate('B', lineB), candidate('C', lineC)],
        {
          riskByBarangay: () => {
            riskCalls += 1;
            return 'LOW';
          },
          reportCountByBarangay: () => 0,
          closedBarangays: new Set<string>(),
          trend: 'steady',
          dataUnavailable: false,
        },
      );
      expect(options).toHaveLength(3);
      // The shared snapshot was consulted (reused), and NO network fetch ran.
      expect(riskCalls).toBeGreaterThan(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});


describe('automatic default validation', () => {
  const candidate: RouteCandidate = {
    id: 'verified', label: 'Verified', route: [[121, 14.6], [121.02, 14.62]],
    maneuvers: [], hazards: [], distanceM: 3000, durationS: 600,
  };
  const context = { riskByBarangay: () => 'LOW' as const, dataUnavailable: false };

  it.each([0, -1, NaN, Infinity])('rejects invalid duration %s', (durationS) => {
    const options = compareRoutes([{ ...candidate, durationS }], context);
    expect(getValidatedDefaultRoute(options)).toBeNull();
    expect(options.every((o) => o.recommendation !== 'recommended')).toBe(true);
  });

  it('rejects exposed, reported, closed, stale, and unknown routes', () => {
    for (const ctx of [
      { riskByBarangay: () => 'ELEVATED' as const },
      { riskByBarangay: () => 'HIGH' as const },
      { ...context, reportCountByBarangay: () => 1 },
      { ...context, closedBarangays: new Set(['test-barangay']) },
      { riskByBarangay: () => 'STALE' as const },
      { riskByBarangay: () => 'UNKNOWN' as const },
      { ...context, dataUnavailable: true },
      {},
    ]) {
      expect(getValidatedDefaultRoute(compareRoutes([candidate], ctx))).toBeNull();
    }
  });

  it('rejects incomplete geographic coverage even when some samples are LOW', () => {
    vi.mocked(resolution.resolveBarangayForPoint).mockImplementation((lng) => lng < 121.01 ? 'test-barangay' : null);
    const option = compareRoutes([candidate], context)[0];
    expect(option.risk.exposureVerified).toBe(false);
    expect(isDefaultRouteEligible(option)).toBe(false);
    expect(getValidatedDefaultRoute([option])).toBeNull();
  });

  it('uses earliest ETA among zero-exposure routes, and distance for equal times', () => {
    const options = compareRoutes([
      { ...candidate, id: 'short-distance', route: [[121, 14.6], [121.002, 14.624], [121.02, 14.62]] as [number, number][], durationS: 900, distanceM: 2000 },
      { ...candidate, id: 'early-arrival', route: [[121, 14.6], [121.021, 14.602], [121.02, 14.62]] as [number, number][], durationS: 500, distanceM: 4000 },
      { ...candidate, id: 'early-shorter', durationS: 500, distanceM: 3500 },
    ], context);
    expect(getValidatedDefaultRoute(options)?.candidate.id).toBe('early-shorter');
    expect(options[0].candidate.id).toBe('early-shorter');
  });

  it('rejects straight-line fallback directions and invalid geometry', () => {
    const option = compareRoutes([candidate], context)[0];
    expect(isDefaultRouteEligible({ ...option, candidate: { ...candidate, id: 'direct-line' } })).toBe(false);
    expect(isDefaultRouteEligible({ ...option, candidate: { ...candidate, route: [[NaN, 14.6], [121, 14.62]] } })).toBe(false);
  });
});


it('uses stable Route B identity for fallback even when ranking changes card order', async () => {
  const options = compareRoutes(await planRoutes(PITX, MOA), { dataUnavailable: true });
  expect(getValidatedDefaultRoute(options)).toBeNull();
  expect(getInitialRouteSelection([...options].reverse())?.candidate.id).toBe('pitx-moa-lowrisk');
  const verified = compareRoutes(await planRoutes(PITX, MOA), { riskByBarangay: () => 'LOW' });
  expect(getInitialRouteSelection(verified)).toEqual(getValidatedDefaultRoute(verified));
});


it('prioritizes recommended Route A and falls back to Route B only when none qualifies', async () => {
  const candidates = (await planRoutes(PITX, MOA)).map((candidate) => ({
    ...candidate, hazards: [], durationS: candidate.id === 'pitx-moa-primary' ? 300 : 900,
  }));
  const available = compareRoutes(candidates, { riskByBarangay: () => 'LOW' });
  expect(getInitialRouteSelection([...available].reverse())?.candidate.id).toBe('pitx-moa-primary');
  const unavailable = compareRoutes(candidates, { dataUnavailable: true });
  expect(unavailable.some((o) => o.recommendation === 'recommended')).toBe(false);
  expect(getInitialRouteSelection(unavailable)?.candidate.id).toBe('pitx-moa-lowrisk');
});


describe('route suggestion decision evidence', () => {
  const base: RouteCandidate = {
    id: 'a', label: 'Route A', route: [[121, 14.6], [121.05, 14.6]],
    maneuvers: [], hazards: [], distanceM: 5000, durationS: 500,
  };
  const alternate: RouteCandidate = {
    ...base, id: 'b', label: 'Route B', route: [[121, 14.6], [121.025, 14.61], [121.05, 14.6]],
    distanceM: 6000, durationS: 700,
  };

  it('suppresses almost identical suggestions even when IDs and ETA differ', () => {
    const options = compareRoutes([base, { ...base, id: 'copy', durationS: 600 }, alternate], {
      riskByBarangay: () => 'LOW',
    });
    expect(options).toHaveLength(2);
    expect(options.map((o) => o.candidate.id)).toEqual(['a', 'b']);
  });

  it('explains equal LOW flood assessments without inventing flood differences', () => {
    const options = compareRoutes([base, alternate], { riskByBarangay: () => 'LOW' });
    expect(sameRouteFloodAssessment(options[0], options[1])).toBe(true);
    expect(options[0].recommendation).toBe('recommended');
    expect(options[1].comparison).toMatchObject({ sameFloodAssessment: true, extraDurationS: 200, extraDistanceM: 1000 });
    expect(options[1].suggestion).toBe('Different roads · Same current flood assessment');
    expect(options[1].reasons.some((reason) => reason.text.includes('No measured flood advantage'))).toBe(true);
  });

  it('distinguishes equal worst-risk labels by actual exposed route length', () => {
    vi.mocked(resolution.resolveBarangayForPoint).mockImplementation((_, lat) => lat > 14.602 ? 'higher' : 'lower');
    const context = { riskByBarangay: (psgc: string) => psgc === 'higher' ? 'HIGH' as const : 'LOW' as const };
    const shortExposure = { ...base, route: [[121, 14.6], [121.025, 14.604], [121.05, 14.6]] as [number, number][] };
    const options = compareRoutes([shortExposure, alternate], context);
    expect(options).toHaveLength(2);
    expect(options[0].risk.level).toBe('HIGH');
    expect(options[1].risk.level).toBe('HIGH');
    expect(options[0].risk.exposureDistanceM).not.toBe(options[1].risk.exposureDistanceM);
    expect(sameRouteFloodAssessment(options[0], options[1])).toBe(false);
  });
});
