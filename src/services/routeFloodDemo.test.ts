import { describe, expect, it } from 'vitest';
import { assignRouteFloodDemos, createRouteFloodDemo } from './routeFloodDemo';
import {
  planRoutes,
  summarizeRouteRisk,
  isRouteStartBlocked,
  compareRoutes,
} from './routePlanning';
import { measureRoute, pointAlong, nearestAlong, type LngLat } from '../simulation/routeGeometry';
import { PITX_TO_MOA_ROUTE } from '../data/fixtures/pitxToMoaRoute';

const bent: LngLat[] = [
  [121, 14.6],
  [121.01, 14.6],
  [121.01, 14.62],
];
const alternative: LngLat[] = [
  [121, 14.6],
  [120.98, 14.61],
  [121.01, 14.62],
];

function expectOnRoute(
  route: ReadonlyArray<LngLat>,
  demos: ReadonlyArray<ReturnType<typeof createRouteFloodDemo>[number]>,
) {
  const measured = measureRoute(route);
  for (const demo of demos) {
    expect(demo.atM).toBeGreaterThan(0);
    expect(demo.atM).toBeLessThan(measured.length);
    expect(nearestAlong(measured, pointAlong(measured, demo.atM)).offM).toBeLessThan(0.01);
  }
}

function expectDistributed(
  candidates: ReadonlyArray<{
    route: ReadonlyArray<LngLat>;
    demoFloods?: ReadonlyArray<ReturnType<typeof createRouteFloodDemo>[number]>;
  }>,
) {
  const withDemos = candidates.filter((c) => (c.demoFloods?.length ?? 0) > 0);
  expect(withDemos).toHaveLength(2);
  expect(withDemos.every((c) => (c.demoFloods?.length ?? 0) === 1)).toBe(true);
  expect(withDemos.flatMap((c) => (c.demoFloods ?? []).map((d) => d.passability)).sort()).toEqual([
    'not-passable',
    'passable',
  ]);
  for (const candidate of candidates) expectOnRoute(candidate.route, candidate.demoFloods ?? []);
}

describe('dynamic route flood demos', () => {
  it.each(['passable', 'not-passable'] as const)(
    'places a deterministic %s point on the path',
    (passability) => {
      const steps = [
        { atM: 0, type: 'depart', modifier: null, street: 'Demo Street', instruction: 'Depart' },
      ];
      const demos = createRouteFloodDemo(bent, steps, passability);
      expect(demos).toHaveLength(1);
      expect(demos[0]).toMatchObject({
        passability,
        street: 'Demo Street',
        state: passability === 'passable' ? 'YELLOW' : 'RED',
      });
      expectOnRoute(bent, demos);
      expect(createRouteFloodDemo(bent, steps, passability)).toEqual(demos);
    },
  );

  it('uses different options and leaves the third option without a demo', () => {
    const candidates = [bent, alternative, [...bent].reverse()].map((route) => ({
      route,
      maneuvers: [],
      hazards: [],
    }));
    const result = assignRouteFloodDemos(candidates);
    expectDistributed(result);
    expect(result[2].demoFloods).toEqual([]);
    expect(assignRouteFloodDemos(candidates)).toEqual(result);
  });

  it('adapts to reversed, short and changed journeys', () => {
    for (const route of [
      [...bent].reverse(),
      [
        [121, 14.6],
        [121.00001, 14.6],
      ] as LngLat[],
      [
        [120.98, 14.5],
        [121.1, 14.7],
      ] as LngLat[],
    ]) {
      expectOnRoute(route, createRouteFloodDemo(route, [], 'passable'));
    }
  });

  it('does not fabricate points for invalid or zero-length journeys', () => {
    for (const route of [
      [],
      [[121, 14.6]],
      [
        [121, 14.6],
        [121, 14.6],
      ],
      [
        [NaN, 14.6],
        [121, 14.6],
      ],
    ] as LngLat[][]) {
      expect(createRouteFloodDemo(route, [], 'passable')).toEqual([]);
    }
  });

  it('distributes demos across the bundled routes, including after comparison', async () => {
    const candidates = await planRoutes(
      PITX_TO_MOA_ROUTE[0],
      PITX_TO_MOA_ROUTE[PITX_TO_MOA_ROUTE.length - 1],
    );
    expectDistributed(candidates);
    expect(candidates[0].demoFloods?.[0].passability).toBe('not-passable');
    expect(candidates[1].demoFloods?.[0].passability).toBe('passable');
    expect(candidates[2].demoFloods).toEqual([]);
    expectDistributed(compareRoutes(candidates).map((o) => o.candidate));
  });

  it.each(['drive', 'bike', 'walk'] as const)(
    'distributes provider demos for %s without creating official closures',
    async (mode) => {
      const candidates = await planRoutes(bent[0], bent[bent.length - 1], {
        mode,
        mapboxToken: 'test',
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            code: 'Ok',
            routes: [bent, alternative].map((coordinates) => ({
              geometry: { type: 'LineString', coordinates },
              distance: 3300,
              duration: 500,
              legs: [],
            })),
          }),
        }),
      });
      expectDistributed(candidates);
      expect(candidates.every((c) => summarizeRouteRisk(c).closureCount === 0)).toBe(true);
      expect(compareRoutes(candidates).every((o) => !isRouteStartBlocked(o))).toBe(true);
    },
  );

  it('does not place both conditions on a single-route fallback', async () => {
    const candidates = await planRoutes(bent[0], bent[bent.length - 1]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].demoFloods).toHaveLength(1);
    expect(candidates[0].demoFloods?.[0].passability).toBe('passable');
  });
});
