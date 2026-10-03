/// <reference types="geojson" />
// src/data/fixtures/routes.ts
//
// ⚠️ DEMO / FIXTURE DATA — NOT AUTHORITATIVE ⚠️
// Sample route geometry for development only. These LineStrings are hand-drawn
// demo paths between two NCR points — they are NOT produced by any routing
// engine and must not be presented as authoritative (Req 15.1, 15.2, 15.4,
// 16.1, 16.5).

import type { Route, RouteAlternative } from '../../types/route';

/** Demo marker attached to route fixtures (Req 15.4). */
export const ROUTES_DEMO_SOURCE = 'DEMO — route geometry (fixture)';

/** Marks this module's contents as demo/fixture data (Req 15.2). */
export const ROUTES_IS_DEMO = true;

/**
 * Two demo alternatives between roughly Quezon City (origin) and Makati
 * (destination). Geometry only — no routing engine (Req 16.5).
 */
export const routeFixtures: Route[] = [
  {
    id: 'demo-route-a',
    label: 'DEMO Route A — via EDSA (fixture)',
    geometry: {
      type: 'LineString',
      coordinates: [
        [121.05, 14.676],
        [121.043, 14.64],
        [121.038, 14.61],
        [121.033, 14.58],
        [121.028, 14.556],
      ],
    },
  },
  {
    id: 'demo-route-b',
    label: 'DEMO Route B — via C5 (fixture)',
    geometry: {
      type: 'LineString',
      coordinates: [
        [121.05, 14.676],
        [121.072, 14.64],
        [121.08, 14.6],
        [121.06, 14.57],
        [121.028, 14.556],
      ],
    },
  },
];

/** The demo route alternatives collection (Req 16.1). */
export const routeAlternativeFixture: RouteAlternative = {
  routeId: 'demo-alternatives-qc-to-makati',
  routes: routeFixtures,
};
