/// <reference types="geojson" />
// src/data/fixtures/floodSusceptibility.ts
//
// ⚠️ DEMO / FIXTURE DATA — NOT AUTHORITATIVE ⚠️
// Modeled flood-susceptibility polygons for development only. These are
// plausible, hand-drawn demo shapes following low-lying areas and waterways
// (Marikina River corridor, Pasig River, Manila Bay coastal edge). They are
// NOT derived from any real flood dataset and must not be presented as
// authoritative or verified (Req 15.1, 15.2, 15.4).
//
// DESIGN CONSTRAINT (Flood Map Visual Concept): flood risk is NOT an
// administrative boundary. These polygons are intentionally elongated,
// waterway-following hazard shapes and are DELIBERATELY DISTINCT from the
// city-boundary geometry in boundaries.ts. Never reuse city-boundary shapes as
// a risk proxy.

import type { FloodSusceptibility } from '../../types/flood';

/** Demo source marker attached to every susceptibility fixture (Req 15.4). */
export const SUSCEPTIBILITY_DEMO_SOURCE = 'DEMO — modeled susceptibility (fixture)';

/** Marks this module's contents as demo/fixture data (Req 15.2). */
export const SUSCEPTIBILITY_IS_DEMO = true;

/**
 * The flood susceptibility demo polygons. Elongated, waterway-following shapes
 * — a mix of HIGH / MODERATE / LOW — clearly labeled demo.
 */
export const floodSusceptibilityFixtures: FloodSusceptibility[] = [
  {
    // HIGH — Marikina River corridor: a long, narrow ribbon following the
    // river valley through Marikina and Pasig (low-lying, flood-prone).
    id: 'demo-susceptibility-marikina-corridor',
    level: 'HIGH',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [121.088, 14.688],
          [121.099, 14.672],
          [121.108, 14.651],
          [121.104, 14.62],
          [121.093, 14.59],
          [121.08, 14.566],
          [121.073, 14.57],
          [121.084, 14.593],
          [121.095, 14.622],
          [121.098, 14.65],
          [121.09, 14.671],
          [121.079, 14.686],
          [121.088, 14.688],
        ],
      ],
    },
    metadata: {
      location: { lng: 121.093, lat: 14.63 },
      source: SUSCEPTIBILITY_DEMO_SOURCE,
      dataType: 'SUSCEPTIBILITY',
      updatedAt: 1_700_000_000,
      verificationStatus: 'UNCONFIRMED',
      severity: 'high',
      description:
        'DEMO: modeled high susceptibility along the Marikina River corridor. Not authoritative.',
    },
  },
  {
    // MODERATE — Pasig River corridor: an elongated band along the river as it
    // crosses the metro toward Manila Bay.
    id: 'demo-susceptibility-pasig-river',
    level: 'MODERATE',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [120.985, 14.593],
          [121.02, 14.586],
          [121.055, 14.582],
          [121.078, 14.575],
          [121.079, 14.583],
          [121.056, 14.59],
          [121.021, 14.594],
          [120.986, 14.601],
          [120.985, 14.593],
        ],
      ],
    },
    metadata: {
      location: { lng: 121.03, lat: 14.588 },
      source: SUSCEPTIBILITY_DEMO_SOURCE,
      dataType: 'SUSCEPTIBILITY',
      updatedAt: 1_700_000_000,
      verificationStatus: 'UNCONFIRMED',
      severity: 'moderate',
      description:
        'DEMO: modeled moderate susceptibility along the Pasig River. Not authoritative.',
    },
  },
  {
    // LOW — Manila Bay coastal edge: a thin strip along the western shoreline
    // (coastal / tidal low-lying zone).
    id: 'demo-susceptibility-manila-bay-coast',
    level: 'LOW',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [120.958, 14.64],
          [120.965, 14.61],
          [120.972, 14.575],
          [120.978, 14.54],
          [120.983, 14.5],
          [120.988, 14.5],
          [120.983, 14.54],
          [120.977, 14.576],
          [120.97, 14.611],
          [120.963, 14.641],
          [120.958, 14.64],
        ],
      ],
    },
    metadata: {
      location: { lng: 120.972, lat: 14.57 },
      source: SUSCEPTIBILITY_DEMO_SOURCE,
      dataType: 'SUSCEPTIBILITY',
      updatedAt: 1_700_000_000,
      verificationStatus: 'UNCONFIRMED',
      severity: 'low',
      description:
        'DEMO: modeled low susceptibility along the Manila Bay coastal edge. Not authoritative.',
    },
  },
  {
    // MODERATE — Malabon / Navotas low-lying floodplain: a lobed hazard pocket
    // in the reclaimed, tidal north-west of the metro.
    id: 'demo-susceptibility-camanava-lowland',
    level: 'MODERATE',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [120.94, 14.68],
          [120.958, 14.678],
          [120.968, 14.665],
          [120.962, 14.652],
          [120.948, 14.65],
          [120.936, 14.66],
          [120.938, 14.672],
          [120.94, 14.68],
        ],
      ],
    },
    metadata: {
      location: { lng: 120.952, lat: 14.665 },
      source: SUSCEPTIBILITY_DEMO_SOURCE,
      dataType: 'SUSCEPTIBILITY',
      updatedAt: 1_700_000_000,
      verificationStatus: 'UNCONFIRMED',
      severity: 'moderate',
      description:
        'DEMO: modeled moderate susceptibility in the low-lying CAMANAVA area. Not authoritative.',
    },
  },
];
