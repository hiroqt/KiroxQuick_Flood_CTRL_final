// src/layers/dataLayers.property.test.ts
//
// Property-based tests (fast-check) + example unit tests for the per-category
// DataLayer implementations and the FixtureDataSource.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import {
  loadValidated,
  emptyFeatureCollection,
  isValidFloodReport,
  isValidSusceptibility,
  floodReportsLayer,
  floodSusceptibilityLayer,
  boundariesLayer,
  routesLayer,
  routeFloodSegmentsLayer,
  evacuationCentersLayer,
  communityReportsLayer,
  fixtureLayers,
  ALL_LAYER_IDS,
} from './dataLayers';
import { FixtureDataSource } from '../services/FixtureDataSource';
import type { FloodReport } from '../types/flood';
import type { LayerId } from '../types/layer';

const NUM_RUNS = 200;

// A recent epoch (seconds) so generated reports carry a plausible updatedAt.
const RECENT = 1_700_000_000;

/** Arbitrary for a well-formed FloodReport (valid required metadata). */
const validFloodReportArb: fc.Arbitrary<FloodReport> = fc.record({
  id: fc.string({ minLength: 1 }),
  state: fc.constantFrom('RED', 'ORANGE', 'YELLOW', 'GREEN', 'GRAY'),
  passable: fc.option(fc.boolean(), { nil: undefined }),
  metadata: fc.record({
    location: fc.record({
      lng: fc.double({ min: 120, max: 122, noNaN: true }),
      lat: fc.double({ min: 14, max: 15, noNaN: true }),
    }),
    source: fc.constant('DEMO — property test'),
    dataType: fc.constant('REPORT' as const),
    updatedAt: fc.integer({ min: RECENT - 1000, max: RECENT + 1000 }),
    verificationStatus: fc.constantFrom('VERIFIED', 'UNCONFIRMED'),
  }),
}) as fc.Arbitrary<FloodReport>;

/**
 * Arbitrary for a MALFORMED flood-report-shaped item: an object whose metadata
 * is missing at least one required field (or is entirely absent / not an
 * object). These MUST be skipped by load() and counted in `skipped`.
 */
const malformedFloodReportArb: fc.Arbitrary<unknown> = fc.oneof(
  // Not an object at all.
  fc.constantFrom(null, undefined, 42, 'nope', true),
  // Object with no metadata.
  fc.record({ id: fc.string() }),
  // Object whose metadata is missing required fields.
  fc.record({
    id: fc.string(),
    metadata: fc.record({
      // Deliberately omit source/dataType/updatedAt/verificationStatus and/or
      // give a bad location.
      location: fc.oneof(
        fc.constant(undefined),
        fc.record({ lng: fc.constant('bad'), lat: fc.constant('bad') }),
      ),
    }),
  }),
);

interface TaggedItem {
  item: unknown;
  valid: boolean;
}

/** A mix of valid and malformed items, each tagged with its expected validity. */
const mixedItemsArb: fc.Arbitrary<TaggedItem[]> = fc.array(
  fc.oneof(
    validFloodReportArb.map((item) => ({ item, valid: true })),
    malformedFloodReportArb.map((item) => ({ item, valid: false })),
  ),
  { maxLength: 40 },
);

// Feature: baharoute-metro-manila-map-foundation, Property 9: Malformed items are skipped without throwing
//
// Validates: Requirements 18.2
//
// For any list mixing valid + malformed items, the validate-and-project path
// never throws, returns exactly the valid subset as items, and reports
// skipped === the number of malformed entries.
describe('Property 9: malformed items are skipped without throwing', () => {
  it('returns exactly the valid subset and counts skipped correctly', () => {
    fc.assert(
      fc.property(mixedItemsArb, (tagged) => {
        const candidates = tagged.map((t) => t.item);
        const expectedValid = tagged.filter((t) => t.valid).length;
        const expectedSkipped = tagged.length - expectedValid;

        // Must never throw, even on wholly malformed input.
        const result = loadValidated<FloodReport>(
          candidates,
          isValidFloodReport,
          true,
        );

        expect(result.items.length).toBe(expectedValid);
        expect(result.skipped).toBe(expectedSkipped);
        expect(result.items.length + result.skipped).toBe(candidates.length);
        expect(result.isDemo).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// Feature: baharoute-metro-manila-map-foundation, Property 10: Empty layers project to a well-formed empty collection
//
// Validates: Requirements 18.3
//
// For an empty item list, toGeoJSON([]) returns a valid, well-formed empty
// FeatureCollection (type "FeatureCollection", empty features array).
describe('Property 10: empty layers project to a well-formed empty collection', () => {
  it('toGeoJSON([]) yields a well-formed empty FeatureCollection for every layer', () => {
    const layers = Object.values(fixtureLayers);
    fc.assert(
      fc.property(fc.constantFrom(...layers), (layer) => {
        const fc0 = layer.toGeoJSON([]);
        expect(fc0.type).toBe('FeatureCollection');
        expect(Array.isArray(fc0.features)).toBe(true);
        expect(fc0.features).toHaveLength(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Example unit tests
// ---------------------------------------------------------------------------

describe('DataLayer.load — known mix of valid/malformed items', () => {
  it('returns only valid items with the correct skipped count', () => {
    const candidates: unknown[] = [
      // valid
      {
        id: 'good-1',
        state: 'RED',
        metadata: {
          location: { lng: 121, lat: 14.5 },
          source: 'DEMO',
          dataType: 'REPORT',
          updatedAt: RECENT,
          verificationStatus: 'VERIFIED',
        },
      },
      // malformed: missing source + updatedAt
      {
        id: 'bad-1',
        state: 'RED',
        metadata: { location: { lng: 121, lat: 14.5 } },
      },
      // malformed: not an object
      null,
      // valid
      {
        id: 'good-2',
        state: 'GREEN',
        passable: true,
        metadata: {
          location: { lng: 120.9, lat: 14.6 },
          source: 'DEMO',
          dataType: 'REPORT',
          updatedAt: RECENT,
          verificationStatus: 'UNCONFIRMED',
        },
      },
    ];

    const result = loadValidated<FloodReport>(
      candidates,
      isValidFloodReport,
      true,
    );

    expect(result.items.map((r) => r.id)).toEqual(['good-1', 'good-2']);
    expect(result.skipped).toBe(2);
    expect(result.isDemo).toBe(true);
  });

  it('validates susceptibility geometry as well as metadata', () => {
    const candidates: unknown[] = [
      // valid polygon
      {
        id: 'sus-good',
        level: 'HIGH',
        geometry: { type: 'Polygon', coordinates: [[[0, 0]]] },
        metadata: {
          location: { lng: 121, lat: 14.5 },
          source: 'DEMO',
          dataType: 'SUSCEPTIBILITY',
          updatedAt: RECENT,
          verificationStatus: 'UNCONFIRMED',
        },
      },
      // malformed: valid metadata but no geometry
      {
        id: 'sus-bad',
        level: 'LOW',
        metadata: {
          location: { lng: 121, lat: 14.5 },
          source: 'DEMO',
          dataType: 'SUSCEPTIBILITY',
          updatedAt: RECENT,
          verificationStatus: 'UNCONFIRMED',
        },
      },
    ];

    const result = loadValidated(candidates, isValidSusceptibility, true);
    expect(result.items).toHaveLength(1);
    expect(result.skipped).toBe(1);
  });
});

describe('fixture layers load their demo fixtures without skipping', () => {
  it.each([
    ['boundaries', boundariesLayer],
    ['floodSusceptibility', floodSusceptibilityLayer],
    ['floodReports', floodReportsLayer],
    ['communityReports', communityReportsLayer],
    ['routes', routesLayer],
    ['routeFloodSegments', routeFloodSegmentsLayer],
    ['evacuationCenters', evacuationCentersLayer],
  ] as const)('%s: all fixtures valid, isDemo true', async (_name, layer) => {
    const result = await layer.load();
    expect(result.isDemo).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.skipped).toBe(0);
    // toGeoJSON over the loaded items yields one feature per item.
    const gj = layer.toGeoJSON(result.items as never[]);
    expect(gj.type).toBe('FeatureCollection');
    expect(gj.features).toHaveLength(result.items.length);
  });
});

describe('flood feature projections carry source and updatedAt', () => {
  it('exposes source + updatedAt in report feature properties', async () => {
    const { items } = await floodReportsLayer.load();
    const gj = floodReportsLayer.toGeoJSON(items);
    for (const f of gj.features) {
      expect(f.properties).toBeTruthy();
      expect(typeof f.properties?.source).toBe('string');
      expect(typeof f.properties?.updatedAt).toBe('number');
    }
  });

  it('exposes source + updatedAt in susceptibility feature properties', async () => {
    const { items } = await floodSusceptibilityLayer.load();
    const gj = floodSusceptibilityLayer.toGeoJSON(items);
    for (const f of gj.features) {
      expect(typeof f.properties?.source).toBe('string');
      expect(typeof f.properties?.updatedAt).toBe('number');
    }
  });
});

describe('emptyFeatureCollection helper', () => {
  it('is a well-formed empty FeatureCollection', () => {
    expect(emptyFeatureCollection()).toEqual({
      type: 'FeatureCollection',
      features: [],
    });
  });
});

describe('FixtureDataSource', () => {
  it('reports every fixture layer as demo', () => {
    const source = new FixtureDataSource();
    for (const meta of source.listLayers()) {
      expect(meta.isDemo).toBe(true);
    }
  });

  it('listLayers() returns all LayerIds', () => {
    const source = new FixtureDataSource();
    const ids = source.listLayers().map((m) => m.id);
    const expected: LayerId[] = [...ALL_LAYER_IDS];
    expect(ids.length).toBe(ALL_LAYER_IDS.length);
    expect(new Set(ids)).toEqual(new Set(expected));
  });

  it('getLayer(id) returns the matching DataLayer for each id', () => {
    const source = new FixtureDataSource();
    for (const id of ALL_LAYER_IDS) {
      const layer = source.getLayer(id);
      expect(layer.meta.id).toBe(id);
      expect(layer.meta.isDemo).toBe(true);
      expect(typeof layer.meta.label).toBe('string');
      expect(layer.meta.label.length).toBeGreaterThan(0);
    }
  });
});
