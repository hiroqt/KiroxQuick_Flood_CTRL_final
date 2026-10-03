/// <reference types="geojson" />
// src/data/fixtures/cityFloodSusceptibility.ts
//
// ⚠️ DEMO / FIXTURE DATA — NOT AUTHORITATIVE ⚠️
//
// A per-city, ADMINISTRATIVE flood-SUSCEPTIBILITY SUMMARY for the 17 NCR
// jurisdictions. Each city is assigned a single HIGH / MODERATE / LOW
// susceptibility class and drawn as a translucent, color-coded fill over the
// quiet basemap — reproducing the NCR overview COMPOSITION (a filled,
// color-coded 17-city silhouette with Metro Manila dominant).
//
// GEOMETRY (real administrative boundaries):
//   The silhouette geometry is the REAL Metro Manila city boundary geometry
//   loaded from the local asset `src/data/geojson/metroManilaCityBoundaries.ts`
//   (source: rolex-esto/roberto `data/city_boundaries.geojson`, adapted, stored
//   locally). Geometry is Polygon or MultiPolygon per city. These are
//   ADMINISTRATIVE boundaries: the geometry itself does NOT represent flood
//   conditions — only the labeled, modeled per-city SUMMARY VALUE does.
//
// WHAT THIS IS (and is NOT):
//   - This is a MODELED / HISTORICAL susceptibility SUMMARY per city. It does
//     NOT represent current, live, or recent flooding. Absence of a fill (or a
//     LOW fill) must NEVER be read as "safe" or "passable".
//   - It is DISTINCT from current/recent conditions (which remain flood reports
//     / route segments / markers) and DISTINCT from the hazard-shaped
//     `floodSusceptibility` polygons (waterway/low-lying hazard geometry). This
//     layer summarises susceptibility at the CITY (administrative) level.
//
// WHY AN ADMINISTRATIVE FILL IS ALLOWED HERE:
//   The general design constraint forbids reusing city-boundary geometry as a
//   *hazard* proxy. This layer is explicitly a per-city SUSCEPTIBILITY SUMMARY
//   VALUE (labeled modeled/historical), not a hazard footprint — so drawing the
//   value on the administrative silhouette is intentional and clearly labeled.
//   The hazard-shaped susceptibility polygons remain the authoritative hazard
//   geometry and render ON TOP of this summary.
//
// PALETTE: BahaRoute's reserved SUSCEPTIBILITY_COLORS — HIGH = translucent red,
// MODERATE = translucent orange, LOW = translucent yellow. NO GREEN: green is a
// current-condition state ("Recently Reported Passable") and must never appear
// on a susceptibility layer.

import type {
  FloodItemMetadata,
  SusceptibilityLevel,
} from '../../types/flood';
import {
  metroManilaCityBoundaries,
  type CityBoundaryFeature,
} from '../geojson/metroManilaCityBoundaries';
import { normalizeCityNorm } from '../geojson/cityNameNormalization';

/** Marks this module's contents as demo/fixture data (Req 15.2, 15.4). */
export const CITY_SUSCEPTIBILITY_IS_DEMO = true;

/** Human-facing demo source marker attached to every city summary (Req 15.4). */
export const CITY_SUSCEPTIBILITY_DEMO_SOURCE =
  'DEMO — modeled city susceptibility summary (fixture)';

/** A shared dataset timestamp (epoch seconds) for the demo summary. */
const CITY_SUSCEPTIBILITY_UPDATED_AT = 1_700_000_000;

/**
 * A per-city modeled susceptibility SUMMARY. Carries the assigned class, the
 * REAL administrative boundary geometry (Polygon or MultiPolygon), and flood
 * metadata with `dataType: 'SUSCEPTIBILITY'` so the popup shows source/date +
 * disclaimer.
 */
export interface CitySusceptibilitySummary {
  /** Stable city id — matches the corresponding boundaryFixture id. */
  cityId: string;
  /** City display name — the popup "Area" label. */
  cityName: string;
  /** The modeled susceptibility class for this city (never a flood state). */
  level: SusceptibilityLevel;
  /** The REAL administrative city boundary geometry. */
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  /** Flood metadata; dataType is always 'SUSCEPTIBILITY'. */
  metadata: FloodItemMetadata;
}

/**
 * Approved demo susceptibility class per NCR city (keyed by BahaRoute city id).
 * Spread across all three classes. These are illustrative demo values only —
 * NOT authoritative. NO GREEN.
 */
const CITY_LEVELS: Record<string, SusceptibilityLevel> = {
  // HIGH — low-lying, riverine, or coastal / reclaimed areas.
  malabon: 'HIGH',
  navotas: 'HIGH',
  valenzuela: 'HIGH',
  marikina: 'HIGH',
  manila: 'HIGH',
  pasig: 'HIGH',
  // MODERATE — mixed terrain / partially low-lying.
  caloocan: 'MODERATE',
  pateros: 'MODERATE',
  taguig: 'MODERATE',
  'las-pinas': 'MODERATE',
  paranaque: 'MODERATE',
  pasay: 'MODERATE',
  // LOW — comparatively higher ground.
  'quezon-city': 'LOW',
  makati: 'LOW',
  mandaluyong: 'LOW',
  'san-juan': 'LOW',
  muntinlupa: 'LOW',
};

/**
 * Flattens a Polygon/MultiPolygon into its constituent linear-ring position
 * arrays so a representative point can be derived.
 */
function ringsOf(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): GeoJSON.Position[][] {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates;
  }
  return geometry.coordinates.flat();
}

/**
 * A representative location for the city: the centroid of its geometry's
 * bounding box. Used only for the metadata `location` (popup anchor hint), not
 * for rendering — rendering uses the full polygon geometry.
 */
function boundingBoxCenter(
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon,
): GeoJSON.Position {
  const positions = ringsOf(geometry).flat();
  const lngs = positions.map((p) => p[0]);
  const lats = positions.map((p) => p[1]);
  const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  return [lng, lat];
}

/**
 * Builds the 17 city susceptibility summaries on the REAL boundary geometry.
 *
 * Fails LOUDLY (throws) if a feature's `city_norm` cannot be normalized, or if
 * a normalized city has no approved susceptibility class — so coverage stays
 * honest and cities are never silently dropped.
 */
function buildCityFloodSusceptibilityFixtures(): CitySusceptibilitySummary[] {
  const features = metroManilaCityBoundaries.features as CityBoundaryFeature[];

  return features.map((feature) => {
    const cityNorm = feature.properties?.city_norm;
    if (typeof cityNorm !== 'string' || cityNorm.trim() === '') {
      throw new Error(
        `cityFloodSusceptibility: boundary feature is missing a "city_norm" property.`,
      );
    }

    const city = normalizeCityNorm(cityNorm);
    if (!city) {
      throw new Error(
        `cityFloodSusceptibility: unknown city_norm "${cityNorm}" — ` +
          `no normalization mapping. Every NCR city must be mapped.`,
      );
    }

    const level = CITY_LEVELS[city.id];
    if (!level) {
      throw new Error(
        `cityFloodSusceptibility: no susceptibility class assigned for city ` +
          `"${city.name}" (id "${city.id}").`,
      );
    }

    const geometry = feature.geometry;
    const [lng, lat] = boundingBoxCenter(geometry);

    const metadata: FloodItemMetadata = {
      location: { lng, lat },
      source: CITY_SUSCEPTIBILITY_DEMO_SOURCE,
      dataType: 'SUSCEPTIBILITY',
      updatedAt: CITY_SUSCEPTIBILITY_UPDATED_AT,
      verificationStatus: 'UNCONFIRMED',
      description:
        `DEMO: modeled ${level.toLowerCase()} flood susceptibility summary for ` +
        `${city.name}. Historical/modeled exposure — does not confirm ` +
        `current flooding. Not authoritative.`,
    };

    return {
      cityId: city.id,
      cityName: city.name,
      level,
      geometry,
      metadata,
    };
  });
}

/**
 * The 17 NCR city susceptibility summaries, each built by pairing a REAL
 * administrative boundary polygon (matched by normalized `city_norm`) with its
 * approved modeled class. Every entry is clearly labeled demo, dataType
 * 'SUSCEPTIBILITY', and UNCONFIRMED (modeled/historical, not verified current
 * flooding).
 */
export const cityFloodSusceptibilityFixtures: CitySusceptibilitySummary[] =
  buildCityFloodSusceptibilityFixtures();
