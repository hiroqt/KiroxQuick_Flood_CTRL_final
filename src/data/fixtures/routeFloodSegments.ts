/// <reference types="geojson" />
// src/data/fixtures/routeFloodSegments.ts
//
// ⚠️ DEMO / FIXTURE DATA — NOT AUTHORITATIVE ⚠️
// Sample per-segment flood states for the demo routes, for development only.
// These are invented demo classifications, not real conditions, and must not
// be presented as authoritative (Req 15.1, 15.2, 15.4, 16.1).

import type { RouteFloodSegment } from '../../types/route';

/** Demo marker attached to route flood-segment fixtures (Req 15.4). */
export const ROUTE_FLOOD_SEGMENTS_DEMO_SOURCE = 'DEMO — route flood segments (fixture)';

/** Marks this module's contents as demo/fixture data (Req 15.2). */
export const ROUTE_FLOOD_SEGMENTS_IS_DEMO = true;

/**
 * Per-segment Flood_State along the demo routes. Each segment carries exactly
 * one Flood_State (Req 16.1).
 */
export const routeFloodSegmentFixtures: RouteFloodSegment[] = [
  {
    routeId: 'demo-route-a',
    segment: {
      type: 'LineString',
      coordinates: [
        [121.05, 14.676],
        [121.043, 14.64],
      ],
    },
    state: 'GREEN',
  },
  {
    routeId: 'demo-route-a',
    segment: {
      type: 'LineString',
      coordinates: [
        [121.043, 14.64],
        [121.038, 14.61],
      ],
    },
    state: 'YELLOW',
  },
  {
    routeId: 'demo-route-a',
    segment: {
      type: 'LineString',
      coordinates: [
        [121.038, 14.61],
        [121.028, 14.556],
      ],
    },
    state: 'GRAY',
  },
  {
    routeId: 'demo-route-b',
    segment: {
      type: 'LineString',
      coordinates: [
        [121.072, 14.64],
        [121.08, 14.6],
      ],
    },
    state: 'ORANGE',
  },
  {
    routeId: 'demo-route-b',
    segment: {
      type: 'LineString',
      coordinates: [
        [121.08, 14.6],
        [121.06, 14.57],
      ],
    },
    state: 'RED',
  },
];
