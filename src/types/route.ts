/// <reference types="geojson" />
// src/types/route.ts

import type { FloodState } from './flood';

export interface Route {
  id: string;
  geometry: GeoJSON.LineString;
  label: string;
}

export interface RouteAlternative {
  routeId: string;
  routes: Route[]; // collection of alternatives (Req 16.1)
}

export interface RouteFloodSegment {
  routeId: string;
  segment: GeoJSON.LineString;
  state: FloodState; // per-segment Flood_State (Req 16.1)
}
