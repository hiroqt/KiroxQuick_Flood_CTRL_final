// src/layers/cityFloodSummaryLayer.test.ts
//
// Unit tests for the per-city MODELED flood-susceptibility SUMMARY layer.
//
// These build the layer as DATA and drive a FAKE map adapter + a real
// LayerRegistry — no WebGL map is required (test env is jsdom). We assert:
//   - the fill layer id/type is a translucent area polygon (opacity < 1);
//   - fill-color is data-driven by `level` using the reserved palette, HIGH →
//     red / MODERATE → orange / LOW → yellow, NO GREEN;
//   - installCityFloodSummary registers via LayerRegistry at the LOWEST app slot
//     (below floodSusceptibility and all reports/routes) but ABOVE the basemap;
//   - the GeoJSON source features carry level + cityName + source + updatedAt.

import { describe, expect, it } from 'vitest';

import {
  CITY_SUMMARY_SOURCE_ID,
  CITY_SUMMARY_FILL_LAYER_ID,
  CITY_SUMMARY_OUTLINE_LAYER_ID,
  CITY_SUMMARY_FILL_OPACITY,
  buildCitySummaryFillLayer,
  buildCitySummaryOutlineLayer,
  buildCitySummarySource,
  citySummaryFillColorExpression,
  installCityFloodSummary,
  type MapLayerSpec,
} from './cityFloodSummaryLayer';
import { SUSCEPTIBILITY_COLORS, FLOOD_STATE_COLORS } from '../map/basemap/colorTokens';
import { LayerRegistry, type MapLayerAdapter } from './LayerRegistry';
import {
  buildSusceptibilityFillLayer,
  SUSCEPTIBILITY_FILL_LAYER_ID,
} from './floodSusceptibilityLayer';

// ---------------------------------------------------------------------------
// Fake map: records addSource + addLayer, and models an ordered layer stack.
// ---------------------------------------------------------------------------

interface AddCall {
  id: string;
  beforeId: string | undefined;
}

class FakeMap implements MapLayerAdapter {
  readonly stack: string[] = [];
  readonly addCalls: AddCall[] = [];
  readonly sources = new Map<string, unknown>();

  constructor(basemap: string[] = []) {
    this.stack.push(...basemap);
  }

  addSource(id: string, source: unknown): void {
    this.sources.set(id, source);
  }

  addLayer(layer: MapLayerSpec, beforeId?: string): void {
    this.addCalls.push({ id: layer.id, beforeId });
    if (beforeId !== undefined) {
      const index = this.stack.indexOf(beforeId);
      if (index !== -1) {
        this.stack.splice(index, 0, layer.id);
        return;
      }
    }
    this.stack.push(layer.id);
  }

  removeLayer(id: string): void {
    const index = this.stack.indexOf(id);
    if (index !== -1) this.stack.splice(index, 1);
  }

  setLayoutProperty(): void {
    /* not exercised here */
  }

  getLayer(id: string): unknown {
    return this.stack.includes(id) ? { id } : undefined;
  }
}

const BASEMAP = [
  'background',
  'water',
  'parks',
  'buildings',
  'roads',
  'labels',
  'boundaries',
];

// ---------------------------------------------------------------------------
// Fill layer: id, type, color, translucent opacity
// ---------------------------------------------------------------------------

describe('buildCitySummaryFillLayer', () => {
  it('is an area-polygon fill layer with the fixed app id and source', () => {
    const layer = buildCitySummaryFillLayer();
    expect(layer.id).toBe(CITY_SUMMARY_FILL_LAYER_ID);
    expect(layer.id).toBe('cityFloodSummary');
    expect(layer.type).toBe('fill');
    expect(layer.source).toBe(CITY_SUMMARY_SOURCE_ID);
  });

  it('is translucent (opacity < 1) so the basemap stays readable underneath', () => {
    const layer = buildCitySummaryFillLayer();
    expect(layer.paint['fill-opacity']).toBe(CITY_SUMMARY_FILL_OPACITY);
    expect(layer.paint['fill-opacity']).toBeGreaterThan(0);
    expect(layer.paint['fill-opacity']).toBeLessThan(1);
  });

  it('maps HIGH/MODERATE/LOW to the reserved SUSCEPTIBILITY_COLORS hexes (no green)', () => {
    const expr = citySummaryFillColorExpression();
    expect(expr[0]).toBe('match');
    expect(expr[1]).toEqual(['get', 'level']);

    expect(expr).toEqual([
      'match',
      ['get', 'level'],
      'HIGH',
      SUSCEPTIBILITY_COLORS.HIGH.hex,
      'MODERATE',
      SUSCEPTIBILITY_COLORS.MODERATE.hex,
      'LOW',
      SUSCEPTIBILITY_COLORS.LOW.hex,
      SUSCEPTIBILITY_COLORS.LOW.hex,
    ]);

    // The GREEN current-condition color never appears on this layer.
    expect(expr).not.toContain(FLOOD_STATE_COLORS.GREEN.hex);

    expect(buildCitySummaryFillLayer().paint['fill-color']).toEqual(expr);
  });
});

describe('buildCitySummaryOutlineLayer', () => {
  it('is a subtle line layer over the same source', () => {
    const outline = buildCitySummaryOutlineLayer();
    expect(outline.id).toBe(CITY_SUMMARY_OUTLINE_LAYER_ID);
    expect(outline.type).toBe('line');
    expect(outline.source).toBe(CITY_SUMMARY_SOURCE_ID);
    expect(outline.paint['line-opacity']).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// Registration z-order via LayerRegistry
// ---------------------------------------------------------------------------

describe('installCityFloodSummary registration (lowest app layer, above basemap)', () => {
  it('adds the source and registers the fill above the basemap', async () => {
    const map = new FakeMap([...BASEMAP]);
    const registry = new LayerRegistry(map);

    const installed = await installCityFloodSummary(map, registry);

    expect(map.sources.has(CITY_SUMMARY_SOURCE_ID)).toBe(true);
    expect(installed.sourceId).toBe(CITY_SUMMARY_SOURCE_ID);

    const pos = (id: string): number => map.stack.indexOf(id);
    expect(pos('cityFloodSummary')).toBeGreaterThan(pos('boundaries'));
    expect(pos('cityFloodSummary')).toBeGreaterThan(pos('labels'));
    expect(pos('cityFloodSummary')).toBeGreaterThan(pos('roads'));
    expect(pos('cityFloodSummary')).toBeGreaterThan(pos('background'));
  });

  it('places the city summary BELOW the hazard-shaped floodSusceptibility polygons', async () => {
    const map = new FakeMap([...BASEMAP]);
    const registry = new LayerRegistry(map);

    // Install the hazard-shaped susceptibility fill first (higher app layer),
    // then the city summary. Order of installation does not matter; the
    // registry enforces the fixed z-order.
    registry.addAppLayer(buildSusceptibilityFillLayer());
    await installCityFloodSummary(map, registry);

    const pos = (id: string): number => map.stack.indexOf(id);
    // City summary is the LOWEST app layer — beneath the hazard susceptibility.
    expect(pos('cityFloodSummary')).toBeLessThan(
      pos(SUSCEPTIBILITY_FILL_LAYER_ID),
    );
    // ...but still above the basemap.
    expect(pos('cityFloodSummary')).toBeGreaterThan(pos('boundaries'));
  });

  it('adds the outline companion on top of the city fill', async () => {
    const map = new FakeMap([...BASEMAP]);
    const registry = new LayerRegistry(map);

    await installCityFloodSummary(map, registry);

    const pos = (id: string): number => map.stack.indexOf(id);
    expect(pos(CITY_SUMMARY_OUTLINE_LAYER_ID)).toBeGreaterThan(
      pos('cityFloodSummary'),
    );
  });
});

// ---------------------------------------------------------------------------
// GeoJSON source from demo fixtures
// ---------------------------------------------------------------------------

describe('buildCitySummarySource (from demo fixtures)', () => {
  it('builds a GeoJSON source whose features carry level + cityName + source + updatedAt', async () => {
    const source = await buildCitySummarySource();

    expect(source.type).toBe('geojson');
    expect(source.data.type).toBe('FeatureCollection');
    // All 17 cities.
    expect(source.data.features.length).toBe(17);

    for (const feature of source.data.features) {
      const props = feature.properties ?? {};
      expect(['HIGH', 'MODERATE', 'LOW']).toContain(props.level);
      expect(typeof props.cityName).toBe('string');
      expect((props.cityName as string).length).toBeGreaterThan(0);
      expect(typeof props.source).toBe('string');
      expect((props.source as string).length).toBeGreaterThan(0);
      expect(typeof props.updatedAt).toBe('number');
      // City summary is drawn on the REAL administrative silhouette — a
      // Polygon or MultiPolygon (Mapbox `fill` renders both).
      expect(['Polygon', 'MultiPolygon']).toContain(feature.geometry.type);
    }
  });

  it('preserves MultiPolygon geometry through to the source features', async () => {
    const source = await buildCitySummarySource();
    // The real NCR dataset includes at least one MultiPolygon city; it must
    // pass through intact so Mapbox `fill` renders every part.
    const hasMultiPolygon = source.data.features.some(
      (f) => f.geometry.type === 'MultiPolygon',
    );
    expect(hasMultiPolygon).toBe(true);
  });

  it('includes all three susceptibility levels', async () => {
    const source = await buildCitySummarySource();
    const levels = new Set(
      source.data.features.map((f) => (f.properties ?? {}).level),
    );
    expect(levels.has('HIGH')).toBe(true);
    expect(levels.has('MODERATE')).toBe(true);
    expect(levels.has('LOW')).toBe(true);
  });
});
