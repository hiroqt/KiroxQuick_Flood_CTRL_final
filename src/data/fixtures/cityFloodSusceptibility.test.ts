// src/data/fixtures/cityFloodSusceptibility.test.ts
//
// Tests for the per-city MODELED flood-susceptibility SUMMARY fixture, now built
// on the REAL Metro Manila administrative boundary geometry. This is an
// ADDITIVE, compliant layer that reproduces the NCR overview composition while
// preserving BahaRoute flood semantics:
//   - all 17 NCR cities present with a level ∈ {HIGH, MODERATE, LOW};
//   - NONE use green / a current-condition flood state;
//   - each carries dataType 'SUSCEPTIBILITY' + a demo source;
//   - each geometry is the REAL boundary polygon (Polygon or MultiPolygon),
//     NOT an artificial rectangle / bounding box;
//   - the labels/descriptions never claim "safe"/"no risk"/"passable" or a
//     numeric safety score.

import { describe, it, expect } from 'vitest';

import {
  cityFloodSusceptibilityFixtures,
  CITY_SUSCEPTIBILITY_IS_DEMO,
  CITY_SUSCEPTIBILITY_DEMO_SOURCE,
} from './cityFloodSusceptibility';
import {
  metroManilaCityBoundaries,
  type CityBoundaryFeature,
} from '../geojson/metroManilaCityBoundaries';
import { normalizeCityNorm } from '../geojson/cityNameNormalization';
import type { SusceptibilityLevel } from '../../types/flood';

const LEVELS: readonly SusceptibilityLevel[] = ['HIGH', 'MODERATE', 'LOW'];

/** Banned wording that must never appear on a susceptibility layer. */
const BANNED = ['safe', 'no risk', 'clear', 'passable', 'green', 'score'];

/** The 17 expected NCR LGU display names (exactly, with accents). */
const EXPECTED_CITY_NAMES = [
  'Caloocan',
  'Las Piñas',
  'Makati',
  'Malabon',
  'Mandaluyong',
  'Manila',
  'Marikina',
  'Muntinlupa',
  'Navotas',
  'Parañaque',
  'Pasay',
  'Pasig',
  'Pateros',
  'Quezon City',
  'San Juan',
  'Taguig',
  'Valenzuela',
];

/** Approved demo class per city (illustrative demo, not authoritative). */
const EXPECTED_LEVEL_BY_NAME: Record<string, SusceptibilityLevel> = {
  Malabon: 'HIGH',
  Navotas: 'HIGH',
  Valenzuela: 'HIGH',
  Marikina: 'HIGH',
  Manila: 'HIGH',
  Pasig: 'HIGH',
  Caloocan: 'MODERATE',
  Pateros: 'MODERATE',
  Taguig: 'MODERATE',
  'Las Piñas': 'MODERATE',
  Parañaque: 'MODERATE',
  Pasay: 'MODERATE',
  'Quezon City': 'LOW',
  Makati: 'LOW',
  Mandaluyong: 'LOW',
  'San Juan': 'LOW',
  Muntinlupa: 'LOW',
};

/** All linear rings of a Polygon/MultiPolygon. */
function ringsOf(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): GeoJSON.Position[][] {
  return geometry.type === 'Polygon'
    ? geometry.coordinates
    : geometry.coordinates.flat();
}

/**
 * A ring is "rectangle-like" (an artificial bounding box) when it has ≤5
 * positions AND only 2 distinct lng values AND only 2 distinct lat values.
 */
function isRectangleLikeRing(ring: GeoJSON.Position[]): boolean {
  if (ring.length > 5) {
    return false;
  }
  const lngs = new Set(ring.map((p) => p[0]));
  const lats = new Set(ring.map((p) => p[1]));
  return lngs.size <= 2 && lats.size <= 2;
}

function geometryKey(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): string {
  return JSON.stringify([geometry.type, geometry.coordinates]);
}

describe('local Metro Manila boundary dataset', () => {
  it('is a FeatureCollection of 17 Polygon/MultiPolygon features', () => {
    expect(metroManilaCityBoundaries.type).toBe('FeatureCollection');
    expect(metroManilaCityBoundaries.features.length).toBe(17);
    for (const f of metroManilaCityBoundaries.features) {
      expect(['Polygon', 'MultiPolygon']).toContain(f.geometry.type);
    }
  });

  it('every source city_norm normalizes to a BahaRoute city id', () => {
    for (const f of metroManilaCityBoundaries.features as CityBoundaryFeature[]) {
      const city = normalizeCityNorm(f.properties.city_norm);
      expect(city, `city_norm "${f.properties.city_norm}"`).toBeDefined();
      expect(typeof city!.id).toBe('string');
      expect(typeof city!.name).toBe('string');
    }
  });

  it('handles accent/variant city_norm cases explicitly', () => {
    expect(normalizeCityNorm('QUEZON')).toEqual({
      id: 'quezon-city',
      name: 'Quezon City',
    });
    expect(normalizeCityNorm('LAS PINAS')).toEqual({
      id: 'las-pinas',
      name: 'Las Piñas',
    });
    expect(normalizeCityNorm('PARANAQUE')).toEqual({
      id: 'paranaque',
      name: 'Parañaque',
    });
  });

  it('returns undefined for unknown city_norm values', () => {
    expect(normalizeCityNorm('ATLANTIS')).toBeUndefined();
    expect(normalizeCityNorm('quezon')).toBeUndefined(); // case-sensitive keys
    expect(normalizeCityNorm('')).toBeUndefined();
  });
});

describe('city flood susceptibility SUMMARY fixture', () => {
  it('is marked demo', () => {
    expect(CITY_SUSCEPTIBILITY_IS_DEMO).toBe(true);
    expect(CITY_SUSCEPTIBILITY_DEMO_SOURCE.toUpperCase()).toContain('DEMO');
  });

  it('covers all 17 NCR cities exactly once (exact display names)', () => {
    expect(cityFloodSusceptibilityFixtures.length).toBe(17);

    const names = cityFloodSusceptibilityFixtures.map((c) => c.cityName).sort();
    expect(names).toEqual([...EXPECTED_CITY_NAMES].sort());
    expect(new Set(names).size).toBe(17);
  });

  it('assigns every city a level in {HIGH, MODERATE, LOW} and never green/current', () => {
    for (const c of cityFloodSusceptibilityFixtures) {
      expect(LEVELS).toContain(c.level);
      expect(['GREEN', 'RED', 'ORANGE', 'YELLOW', 'GRAY']).not.toContain(
        c.level as string,
      );
    }
  });

  it('spreads assignments across all three classes', () => {
    const used = new Set(cityFloodSusceptibilityFixtures.map((c) => c.level));
    expect(used.has('HIGH')).toBe(true);
    expect(used.has('MODERATE')).toBe(true);
    expect(used.has('LOW')).toBe(true);
  });

  it('attaches each approved demo class to the intended city', () => {
    for (const c of cityFloodSusceptibilityFixtures) {
      expect(c.level).toBe(EXPECTED_LEVEL_BY_NAME[c.cityName]);
    }
    // Spot checks from the approved list.
    const byName = new Map(
      cityFloodSusceptibilityFixtures.map((c) => [c.cityName, c]),
    );
    expect(byName.get('Manila')!.level).toBe('HIGH');
    expect(byName.get('Quezon City')!.level).toBe('LOW');
    expect(byName.get('Las Piñas')!.level).toBe('MODERATE');
    expect(byName.get('Parañaque')!.level).toBe('MODERATE');
  });

  it('carries dataType SUSCEPTIBILITY + demo source + UNCONFIRMED metadata', () => {
    for (const c of cityFloodSusceptibilityFixtures) {
      expect(c.metadata.dataType).toBe('SUSCEPTIBILITY');
      expect(c.metadata.source).toBe(CITY_SUSCEPTIBILITY_DEMO_SOURCE);
      expect(c.metadata.source.toUpperCase()).toContain('DEMO');
      expect(c.metadata.verificationStatus).toBe('UNCONFIRMED');
      expect(typeof c.metadata.updatedAt).toBe('number');
    }
  });

  it('uses REAL boundary geometry (Polygon/MultiPolygon), never a rectangle', () => {
    let rectRings = 0;
    for (const c of cityFloodSusceptibilityFixtures) {
      expect(['Polygon', 'MultiPolygon']).toContain(c.geometry.type);
      for (const ring of ringsOf(c.geometry)) {
        if (isRectangleLikeRing(ring)) {
          rectRings += 1;
        }
      }
    }
    expect(rectRings).toBe(0);
  });

  it('matches the REAL GeoJSON feature geometry for each city', () => {
    const geometryByCityId = new Map<string, string>();
    for (const f of metroManilaCityBoundaries.features as CityBoundaryFeature[]) {
      const city = normalizeCityNorm(f.properties.city_norm)!;
      geometryByCityId.set(city.id, geometryKey(f.geometry));
    }
    for (const c of cityFloodSusceptibilityFixtures) {
      expect(geometryKey(c.geometry)).toBe(geometryByCityId.get(c.cityId));
    }
  });

  it('never uses banned safe/current wording in labels or descriptions', () => {
    for (const c of cityFloodSusceptibilityFixtures) {
      const haystack = `${c.cityName} ${c.metadata.description ?? ''} ${
        c.metadata.source
      }`.toLowerCase();
      for (const banned of BANNED) {
        expect(haystack).not.toContain(banned);
      }
    }
  });
});
