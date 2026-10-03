/// <reference types="geojson" />
// src/data/fixtures/boundaries.ts
//
// ⚠️ DEMO / FIXTURE DATA — NOT AUTHORITATIVE ⚠️
// Simplified, hand-placed polygons approximating the 17 NCR jurisdictions.
// These are rough demo shapes for development only; they are NOT official
// administrative boundaries and must not be presented as authoritative.
// They exist to scaffold the `boundaries` DataLayer and will be replaced by a
// real source later (Req 3.1, 15.1, 15.2, 15.4).
//
// IMPORTANT (design constraint): these city-boundary shapes must NOT be reused
// as flood-risk geometry. Flood susceptibility lives in a separate fixture with
// its own flood-hazard-shaped geometry (see floodSusceptibility.ts).

/** Marks this module's contents as demo/fixture data (Req 15.2, 15.4). */
export const BOUNDARIES_IS_DEMO = true;

/** Human-facing marker used by tests and the demo badge. */
export const BOUNDARIES_DEMO_SOURCE = 'DEMO — simplified NCR jurisdictions (fixture)';

export interface BoundaryFeature {
  id: string;
  /** Jurisdiction name (one of the 17 NCR jurisdictions). */
  name: string;
  /** Simplified demo boundary polygon. */
  geometry: GeoJSON.Polygon;
  /** Always true for these fixtures (Req 15.2). */
  isDemo: boolean;
  /** Demo source marker (Req 15.4). */
  source: string;
}

/**
 * Build a small rectangular demo polygon centered at [lng, lat].
 * A rough stand-in for a jurisdiction outline — clearly a demo shape.
 */
function demoBox(lng: number, lat: number, w: number, h: number): GeoJSON.Polygon {
  const west = lng - w / 2;
  const east = lng + w / 2;
  const south = lat - h / 2;
  const north = lat + h / 2;
  return {
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

function boundary(
  id: string,
  name: string,
  lng: number,
  lat: number,
  w: number,
  h: number,
): BoundaryFeature {
  return {
    id,
    name,
    geometry: demoBox(lng, lat, w, h),
    isDemo: BOUNDARIES_IS_DEMO,
    source: BOUNDARIES_DEMO_SOURCE,
  };
}

/**
 * The 17 NCR jurisdictions as simplified demo boxes, roughly placed within
 * Metro Manila (approx lng 120.9–121.15, lat 14.4–14.78).
 */
export const boundaryFixtures: BoundaryFeature[] = [
  boundary('caloocan', 'Caloocan', 120.984, 14.752, 0.06, 0.05),
  boundary('las-pinas', 'Las Piñas', 120.982, 14.451, 0.05, 0.05),
  boundary('makati', 'Makati', 121.03, 14.554, 0.05, 0.04),
  boundary('malabon', 'Malabon', 120.957, 14.662, 0.04, 0.04),
  boundary('mandaluyong', 'Mandaluyong', 121.038, 14.579, 0.035, 0.035),
  boundary('manila', 'Manila', 120.984, 14.599, 0.05, 0.06),
  boundary('marikina', 'Marikina', 121.102, 14.65, 0.05, 0.06),
  boundary('muntinlupa', 'Muntinlupa', 121.038, 14.408, 0.06, 0.06),
  boundary('navotas', 'Navotas', 120.941, 14.667, 0.03, 0.05),
  boundary('paranaque', 'Parañaque', 121.019, 14.48, 0.06, 0.06),
  boundary('pasay', 'Pasay', 121.0, 14.538, 0.04, 0.04),
  boundary('pasig', 'Pasig', 121.081, 14.576, 0.05, 0.05),
  boundary('pateros', 'Pateros', 121.069, 14.545, 0.02, 0.02),
  boundary('quezon-city', 'Quezon City', 121.05, 14.676, 0.1, 0.1),
  boundary('san-juan', 'San Juan', 121.03, 14.601, 0.025, 0.025),
  boundary('taguig', 'Taguig', 121.055, 14.52, 0.06, 0.06),
  boundary('valenzuela', 'Valenzuela', 120.983, 14.696, 0.06, 0.05),
];

/** Convenience GeoJSON projection of the demo boundaries. */
export const boundaryFeatureCollection: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: boundaryFixtures.map((b) => ({
    type: 'Feature',
    id: b.id,
    geometry: b.geometry,
    properties: { name: b.name, isDemo: b.isDemo, source: b.source },
  })),
};
