/// <reference types="geojson" />
// src/types/flood.ts

/** Exactly these five values, no more (Req 12.1, 13.4). */
export type FloodState = 'RED' | 'ORANGE' | 'YELLOW' | 'GREEN' | 'GRAY';

export type VerificationStatus = 'VERIFIED' | 'UNCONFIRMED';

export type FloodDataType = 'SUSCEPTIBILITY' | 'REPORT' | 'COMMUNITY_REPORT';

export type SusceptibilityLevel = 'HIGH' | 'MODERATE' | 'LOW';

export interface GeoLocation {
  lng: number;
  lat: number;
}

/** Required metadata carried by every flood item (Req 12.3). Optional extras (Req 12.4). */
export interface FloodItemMetadata {
  location: GeoLocation;
  source: string;
  dataType: FloodDataType;
  updatedAt: number; // epoch seconds
  verificationStatus: VerificationStatus;
  severity?: string;
  depth?: number; // meters, if available
  description?: string;
  sourceUrl?: string;
}

/** Historical / modeled exposure — DISTINCT from a report (Req 12.2). */
export interface FloodSusceptibility {
  id: string;
  level: SusceptibilityLevel;
  /** Polygon from the FLOOD dataset geometry, never a city-boundary proxy (see Visual Concept constraint). */
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  metadata: FloodItemMetadata; // dataType === 'SUSCEPTIBILITY'
}

/** Current / recent reported flooding (Req 12.6). */
export interface FloodReport {
  id: string;
  state: FloodState;
  /** Present only when passability is known; required for GREEN (Req 12.6). */
  passable?: boolean;
  metadata: FloodItemMetadata; // dataType === 'REPORT'
}
