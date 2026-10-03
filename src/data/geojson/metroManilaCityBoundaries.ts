/// <reference types="geojson" />
// src/data/geojson/metroManilaCityBoundaries.ts
//
// Typed loader for the LOCAL Metro Manila (NCR) city-boundary GeoJSON asset.
//
// PROVENANCE:
//   Source = rolex-esto/roberto `data/city_boundaries.geojson` (public NCR
//   administrative boundaries). The dataset was adapted (normalized to a
//   `properties.city_norm` per feature) and STORED LOCALLY at
//   `src/data/geojson/metroManilaCityBoundaries.geojson`. It is read at BUILD
//   TIME (Vite `?raw` import + JSON.parse) — BahaRoute never fetches boundary
//   geometry from GitHub or any network endpoint at runtime.
//
// IMPORTANT — ADMINISTRATIVE geometry, NOT flood data:
//   These polygons represent ADMINISTRATIVE city/jurisdiction boundaries. The
//   geometry itself does NOT represent flood conditions, susceptibility, or any
//   hazard footprint. It is used only as the silhouette on which clearly
//   labeled, modeled demo susceptibility SUMMARY values are drawn. Absence of a
//   fill (or a LOW fill) must never be read as "safe" or "passable".

import rawBoundaries from './metroManilaCityBoundaries.geojson?raw';

/**
 * The local NCR city-boundary FeatureCollection. Each feature carries
 * `properties.city_norm` (an upper-cased source city key) and a Polygon or
 * MultiPolygon geometry (administrative boundary).
 */
export interface CityBoundaryProperties {
  /** Upper-cased source city key, e.g. "MANILA", "QUEZON", "LAS PINAS". */
  city_norm: string;
}

export type CityBoundaryFeature = GeoJSON.Feature<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  CityBoundaryProperties
>;

export type CityBoundaryCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  CityBoundaryProperties
>;

/**
 * The parsed local boundary dataset. Parsed once at module load. The `?raw`
 * import + JSON.parse approach builds cleanly under both Vite and vitest
 * (jsdom) without special asset plugins.
 */
export const metroManilaCityBoundaries: CityBoundaryCollection = JSON.parse(
  rawBoundaries,
) as CityBoundaryCollection;
