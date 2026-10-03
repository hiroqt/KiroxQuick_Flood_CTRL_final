import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  avoidsFloodPoints,
  findFloodAvoidingReroute,
  findFloodAvoidingReroutes,
  rebaseMovingReroute,
} from './floodAvoidingReroute';
import { measureRoute, pointAlong, type LngLat } from '../simulation/routeGeometry';
import type { FetchLike } from './directions';
import * as resolution from './reportResolution';
import { planRoutes } from './routePlanning';
import { collectRouteFloods, floodHazardsOnRoute } from './routeFloodHazards';
import { PITX_TO_MOA_ROUTE } from '../data/fixtures/pitxToMoaRoute';
import { PITX_TO_MOA_REROUTES } from '../data/fixtures/floodReroutes';
import { branchPoint, stitchReroute } from '../simulation/reroute';

const origin: LngLat = [121, 14.6];
const destination: LngLat = [121.02, 14.6];
const flood: LngLat = [121.01, 14.6];
const crossing = [origin, destination];
const detour: LngLat[] = [origin, [121, 14.61], [121.02, 14.61], destination];
const fetchRoutes =
  (paths: LngLat[][], durations: number[] = []): FetchLike =>
  async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      code: 'Ok',
      routes: paths.map((coordinates, index) => ({
        geometry: { type: 'LineString', coordinates },
        duration: durations[index] ?? 500,
        distance: 3000,
        legs: [],
      })),
    }),
  });
const request = (paths: LngLat[][]) =>
  findFloodAvoidingReroute(origin, destination, [flood], 'flood', 2000, 10, {
    mapboxToken: 'test',
    fetchImpl: fetchRoutes(paths),
  });
afterEach(() => vi.restoreAllMocks());

describe('flood avoiding reroutes', () => {
  it.each(['pitx-moa-primary', 'pitx-moa-longer'])('always has a verified offline detour before the not-passable demo on %s', async (id) => {
    const candidates = await planRoutes(PITX_TO_MOA_ROUTE[0], PITX_TO_MOA_ROUTE[PITX_TO_MOA_ROUTE.length - 1]);
    const candidate = candidates.find((c) => c.id === id)!;
    const base = measureRoute(candidate.route);
    const floods = collectRouteFloods(candidates);
    const points = floods.map((f) => f.position);
    const hazard = floodHazardsOnRoute(candidate.route, floods).find((h) => h.passability === 'not-passable')!;
    const routingM = hazard.atM - 900 + 350;
    const position = pointAlong(base, routingM);
    const fallback = PITX_TO_MOA_REROUTES.flatMap((reroute) => {
      const branch = branchPoint(base, reroute);
      if (!branch || branch.baseM < routingM) return [];
      const next = stitchReroute(base, candidate.maneuvers, reroute, routingM);
      return next ? [{ id: `bundled-${reroute.fromM}`, label: 'Bundled detour', route: next.route,
        maneuvers: next.maneuvers, distanceM: next.lengthM, durationS: next.lengthM / 10, hazards: [] }] : [];
    });
    const offers = await findFloodAvoidingReroutes(position, candidate.route[candidate.route.length - 1],
      points, hazard.id, base.length - routingM, 10, {}, {}, fallback);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((offer) => avoidsFloodPoints(offer.directRoute!.route, points))).toBe(true);
    expect(rebaseMovingReroute(offers[0], base, candidate.maneuvers, hazard.atM - 900, points)).not.toBeNull();
  });
  it('rejects segments crossing a flood even when their vertices miss it', () => {
    expect(avoidsFloodPoints(crossing, [flood])).toBe(false);
    expect(avoidsFloodPoints(detour, [flood])).toBe(true);
  });
  it('offers a provider detour starting at the vehicle and reaching the destination', async () => {
    const offer = await request([crossing, detour]);
    expect(offer?.directRoute?.route).toEqual(detour);
    expect(offer?.directRoute?.route[0]).toEqual(origin);
    expect(offer?.reroute.hazardId).toBe('flood');
  });
  it('returns no offer if every available road still crosses the flood', async () => {
    expect(await request([crossing])).toBeNull();
  });
  it('rejects routes crossing any other known flood point', async () => {
    expect(
      await findFloodAvoidingReroute(
        origin,
        destination,
        [flood, [121.01, 14.61]],
        'flood',
        2000,
        10,
        { mapboxToken: 'test', fetchImpl: fetchRoutes([detour]) },
      ),
    ).toBeNull();
  });
  it('rejects routes requiring a jump from the vehicle or missing the destination', async () => {
    expect(await request([[[121.001, 14.6], ...detour.slice(1)]])).toBeNull();
    expect(await request([[...detour.slice(0, -1), [121.021, 14.6]]])).toBeNull();
  });
  it('does not offer the direct-line network failure fallback', async () => {
    expect(
      await findFloodAvoidingReroute(origin, destination, [flood], 'flood', 2000, 10, {}),
    ).toBeNull();
  });
  it('rejects roads passing a confirmed closure', async () => {
    vi.spyOn(resolution, 'resolveBarangayForPoint').mockReturnValue('closed');
    expect(
      await findFloodAvoidingReroute(
        origin,
        destination,
        [flood],
        'flood',
        2000,
        10,
        { mapboxToken: 'test', fetchImpl: fetchRoutes([detour]) },
        { closedBarangays: new Set(['closed']) },
      ),
    ).toBeNull();
  });
  it('rejects current reported flooding even without a confirmed closure', async () => {
    vi.spyOn(resolution, 'resolveBarangayForPoint').mockReturnValue('flooded');
    expect(
      await findFloodAvoidingReroute(
        origin,
        destination,
        [flood],
        'flood',
        2000,
        10,
        { mapboxToken: 'test', fetchImpl: fetchRoutes([detour]) },
        { riskByBarangay: () => 'REPORTED_FLOODING' },
      ),
    ).toBeNull();
  });
  it('selects the fastest qualifying road even when it is not the first or shortest option', async () => {
    const faster: LngLat[] = [origin, [121, 14.585], [121.02, 14.585], destination];
    const offer = await findFloodAvoidingReroute(origin, destination, [flood], 'flood', 2000, 10, {
      mapboxToken: 'test',
      fetchImpl: fetchRoutes([detour, faster, crossing], [800, 600, 100]),
    });
    expect(offer?.directRoute?.route).toEqual(faster);
    expect(offer?.durationS).toBe(600);
  });

  it('searches waypoint roads when all initial alternatives cross the flood', async () => {
    const fetchImpl: FetchLike = async (url) =>
      fetchRoutes([url.includes('alternatives=true') ? crossing : detour])(url);
    const offer = await findFloodAvoidingReroute(origin, destination, [flood], 'flood', 2000, 10, {
      mapboxToken: 'test',
      fetchImpl,
    });
    expect(offer?.directRoute?.route).toEqual(detour);
  });

  it('searches local detours even when the initial point-exclusion request returns NoRoute', async () => {
    const urls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      urls.push(url);
      return fetchRoutes(url.includes('waypoints=') ? [detour] : [])(url);
    };
    const offer = await findFloodAvoidingReroute(origin, destination, [flood], 'flood', 2000, 10, {
      mapboxToken: 'test', fetchImpl,
    });
    expect(offer?.directRoute?.route).toEqual(detour);
    expect(urls.length).toBeGreaterThan(1);
    const segments = new URL(urls[1]).pathname.split('/');
    const firstVia = segments[segments.length - 1].split(';')[1].split(',').map(Number);
    expect(firstVia[0]).toBeCloseTo(flood[0], 5);
    expect(Math.abs(firstVia[1] - flood[1])).toBeLessThan(0.003);
    expect(urls.every((url) => new URL(url).searchParams.has('exclude'))).toBe(true);
  });

  it('keeps searching when the first three roads have current reported flooding', async () => {
    vi.spyOn(resolution, 'resolveBarangayForPoint').mockImplementation((_lng, lat) => lat > 14.605 ? 'flooded' : 'other');
    const south: LngLat[] = [origin, [121, 14.59], [121.02, 14.59], destination];
    const fetchImpl: FetchLike = async (url) => fetchRoutes(url.includes('waypoints=') ? [south] : [
      detour,
      [origin, [121, 14.615], [121.02, 14.615], destination],
      [origin, [121, 14.62], [121.02, 14.62], destination],
    ])(url);
    const offer = await findFloodAvoidingReroute(origin, destination, [flood], 'flood', 2000, 10, {
      mapboxToken: 'test', fetchImpl,
    }, { riskByBarangay: (psgc) => psgc === 'flooded' ? 'REPORTED_FLOODING' : 'LOW' });
    expect(offer?.directRoute?.route).toEqual(south);
  });

  it('can use a verified bundled road when provider directions are unavailable', async () => {
    const offer = await findFloodAvoidingReroute(
      origin,
      destination,
      [flood],
      'flood',
      2000,
      10,
      {},
      {},
      [
        {
          id: 'bundled',
          label: 'Bundled road',
          route: detour,
          maneuvers: [],
          distanceM: 4500,
          durationS: 900,
          hazards: [],
        },
      ],
    );
    expect(offer?.directRoute?.route).toEqual(detour);
  });
});

it('returns multiple distinct alternatives sorted fastest first', async () => {
  const south: LngLat[] = [origin, [121, 14.585], [121.02, 14.585], destination];
  const offers = await findFloodAvoidingReroutes(origin, destination, [flood], 'flood', 2000, 10, {
    mapboxToken: 'test',
    fetchImpl: fetchRoutes([detour, south], [800, 600]),
  });
  expect(offers).toHaveLength(2);
  expect(offers.map((o) => o.durationS)).toEqual([600, 800]);
});

it('rejoins from the current vehicle position and rejects a missed turn-off', () => {
  const base = measureRoute([origin, [121.04, 14.6]]);
  const path: LngLat[] = [
    origin,
    [121.005, 14.6],
    [121.005, 14.61],
    [121.04, 14.61],
    [121.04, 14.6],
  ];
  const length = measureRoute(path).length;
  const offer = {
    reroute: {
      hazardId: 'flood',
      fromM: 0,
      route: path,
      maneuvers: [],
      distanceM: length,
      originalRemainingM: base.length,
    },
    durationS: 700,
    toBranchM: 500,
    extraM: 0,
    extraS: 0,
    isRetry: false,
  };
  const rebased = rebaseMovingReroute(offer, base, [], 200, [flood]);
  expect(rebased?.directRoute?.route[0]).toEqual(pointAlong(base, 200));
  expect(rebased?.toBranchM).toBeGreaterThan(0);
  expect(rebaseMovingReroute(offer, base, [], 800, [flood])).toBeNull();
});
