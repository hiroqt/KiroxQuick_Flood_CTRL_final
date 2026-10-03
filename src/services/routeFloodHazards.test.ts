import { describe, expect, it } from 'vitest';
import {
  collectRouteFloods,
  floodHazardsOnRoute,
  collectReportedFloods,
} from './routeFloodHazards';
import type { RouteCandidate } from './routePlanning';
import type { LngLat } from '../simulation/routeGeometry';
import type { FloodReport } from '../types/flood';

const path: LngLat[] = [
  [121, 14.6],
  [121.02, 14.6],
];
const candidate = (id: string, route = path): RouteCandidate => ({
  id,
  route,
  label: id,
  maneuvers: [],
  distanceM: 2000,
  durationS: 300,
  hazards: [],
});

describe('flood warnings for all selected routes', () => {
  it('warns A, B and C about the same flood on their shared road', () => {
    const candidates = ['A', 'B', 'C'].map((id) => candidate(id));
    candidates[0] = {
      ...candidates[0],
      demoFloods: [
        { id: 'demo', atM: 1000, state: 'RED', street: 'Shared Road', passability: 'not-passable' },
      ],
    };
    const floods = collectRouteFloods(candidates);
    for (const route of candidates) {
      expect(floodHazardsOnRoute(route.route, floods)).toHaveLength(1);
    }
    expect(candidates[1].demoFloods).toBeUndefined();
  });
  it('does not warn a different road about an off-route flood', () => {
    const route = {
      ...candidate('A'),
      hazards: [{ id: 'flood', atM: 1000, state: 'RED' as const, street: 'Road A' }],
    };
    expect(
      floodHazardsOnRoute(
        [
          [121, 14.61],
          [121.02, 14.61],
        ],
        collectRouteFloods([route]),
      ),
    ).toEqual([]);
  });
  it('deduplicates the same physical flood reported by different candidate routes', () => {
    const route = {
      ...candidate('A'),
      hazards: [{ id: 'flood', atM: 1000, state: 'RED' as const, street: 'Shared Road' }],
    };
    expect(collectRouteFloods([route, { ...route, id: 'C' }])).toHaveLength(1);
  });
  it('includes current report points and excludes expired, resolved or passable-only states', () => {
    const report: FloodReport = {
      id: 'live',
      state: 'RED',
      passable: false,
      metadata: {
        location: { lng: 121.01, lat: 14.6 },
        updatedAt: 10000,
        source: 'Current report',
        dataType: 'REPORT',
        verificationStatus: 'UNCONFIRMED',
      },
    };
    const floods = collectReportedFloods([report], false, 10000);
    expect(floodHazardsOnRoute(path, floods)).toHaveLength(1);
    expect(floods[0].hazard).toMatchObject({
      isDemo: false,
      sourceLabel: 'Current report',
      passability: 'not-passable',
    });
    expect(collectReportedFloods([report], false, 10000000)).toEqual([]);
    expect(
      collectReportedFloods([{ ...report, state: 'GREEN', passable: true }], false, 10000),
    ).toEqual([]);
    expect(
      collectReportedFloods(
        [
          {
            ...report,
            metadata: { ...report.metadata, dataType: 'COMMUNITY_REPORT' },
            lifecycle: 'RESOLVED',
          },
        ],
        false,
        10000,
      ),
    ).toEqual([]);
  });
});
