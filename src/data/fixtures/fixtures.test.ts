// src/data/fixtures/fixtures.test.ts
import { describe, it, expect } from 'vitest';

import {
  boundaryFixtures,
  BOUNDARIES_IS_DEMO,
  BOUNDARIES_DEMO_SOURCE,
} from './boundaries';
import {
  floodSusceptibilityFixtures,
  SUSCEPTIBILITY_IS_DEMO,
  SUSCEPTIBILITY_DEMO_SOURCE,
} from './floodSusceptibility';
import { floodReportFixtures, FLOOD_REPORTS_IS_DEMO } from './floodReports';
import { communityReportFixtures, COMMUNITY_REPORTS_IS_DEMO } from './communityReports';
import { routeFixtures, ROUTES_IS_DEMO } from './routes';
import { routeFloodSegmentFixtures, ROUTE_FLOOD_SEGMENTS_IS_DEMO } from './routeFloodSegments';
import { evacuationCenterFixtures, EVACUATION_CENTERS_IS_DEMO } from './evacuationCenters';

/** Normalize a polygon's coordinate rings to a canonical string for comparison. */
function ringsKey(coordinates: number[][][]): string {
  return JSON.stringify(coordinates);
}

/** Collect the outer ring's coordinates as a Set of "lng,lat" strings. */
function coordSet(coordinates: number[][][]): Set<string> {
  const set = new Set<string>();
  for (const ring of coordinates) {
    for (const [lng, lat] of ring) {
      set.add(`${lng},${lat}`);
    }
  }
  return set;
}

describe('demo/fixture data — labeling', () => {
  it('marks every fixture module as demo', () => {
    expect(BOUNDARIES_IS_DEMO).toBe(true);
    expect(SUSCEPTIBILITY_IS_DEMO).toBe(true);
    expect(FLOOD_REPORTS_IS_DEMO).toBe(true);
    expect(COMMUNITY_REPORTS_IS_DEMO).toBe(true);
    expect(ROUTES_IS_DEMO).toBe(true);
    expect(ROUTE_FLOOD_SEGMENTS_IS_DEMO).toBe(true);
    expect(EVACUATION_CENTERS_IS_DEMO).toBe(true);
  });

  it('marks each boundary feature demo with a demo source', () => {
    expect(boundaryFixtures.length).toBe(17);
    for (const b of boundaryFixtures) {
      expect(b.isDemo).toBe(true);
      expect(b.source).toBe(BOUNDARIES_DEMO_SOURCE);
      expect(b.source.toUpperCase()).toContain('DEMO');
    }
  });

  it('uses a demo source string for every flood item fixture', () => {
    for (const s of floodSusceptibilityFixtures) {
      expect(s.metadata.source).toBe(SUSCEPTIBILITY_DEMO_SOURCE);
      expect(s.metadata.source.toUpperCase()).toContain('DEMO');
      expect(s.metadata.dataType).toBe('SUSCEPTIBILITY');
    }
    for (const r of floodReportFixtures) {
      expect(r.metadata.source.toUpperCase()).toContain('DEMO');
      expect(r.metadata.dataType).toBe('REPORT');
    }
    for (const c of communityReportFixtures) {
      expect(c.metadata.source.toUpperCase()).toContain('DEMO');
      expect(c.metadata.dataType).toBe('COMMUNITY_REPORT');
      // Community reports are always UNCONFIRMED (Req 14.3).
      expect(c.metadata.verificationStatus).toBe('UNCONFIRMED');
    }
  });

  it('labels routes and evacuation centers as demo', () => {
    for (const r of routeFixtures) {
      expect(r.label.toUpperCase()).toContain('DEMO');
    }
    expect(routeFloodSegmentFixtures.length).toBeGreaterThan(0);
    for (const e of evacuationCenterFixtures) {
      expect(`${e.name} ${e.description}`.toUpperCase()).toContain('DEMO');
    }
  });
});

describe('flood susceptibility geometry ≠ city-boundary geometry (design constraint)', () => {
  it('no susceptibility polygon is identical to any boundary polygon', () => {
    const boundaryKeys = new Set(
      boundaryFixtures.map((b) => ringsKey(b.geometry.coordinates)),
    );

    for (const s of floodSusceptibilityFixtures) {
      expect(s.geometry.type).toBe('Polygon');
      const geom = s.geometry as GeoJSON.Polygon;
      // Deep-inequality: the ring coordinates must not be a copy of any boundary.
      expect(boundaryKeys.has(ringsKey(geom.coordinates))).toBe(false);
    }
  });

  it('no susceptibility polygon shares an entire coordinate ring with a boundary', () => {
    // A boundary box's coordinate set should never fully match a susceptibility
    // polygon's coordinate set — flood risk is not an administrative boundary.
    for (const s of floodSusceptibilityFixtures) {
      const susSet = coordSet((s.geometry as GeoJSON.Polygon).coordinates);
      for (const b of boundaryFixtures) {
        const bSet = coordSet(b.geometry.coordinates);
        const identical =
          bSet.size === susSet.size && [...bSet].every((c) => susSet.has(c));
        expect(identical).toBe(false);
      }
    }
  });
});
