// src/components/markers/mapboxMarkerFactory.ts
//
// The production MarkerFactory: builds a real Mapbox HTML `Marker` overlay from
// a DOM element (design → markers use HTML Marker overlays so they carry
// accessible labels/focus and sit topmost above the canvas layers). Group 2
// engine swap: mapbox-gl replaces maplibre-gl; the Marker API is compatible
// (setLngLat/addTo/remove/getElement).
//
// This is isolated from markerManager.ts (which stays jsdom-friendly and does
// not import mapbox-gl) so MarkerManager can be unit-tested with a fake factory
// while real usage wires up this one.

import mapboxgl from 'mapbox-gl';
import type { MarkerFactory, MarkerLike } from './markerManager';

/**
 * Builds a {@link MarkerLike} backed by a real `mapboxgl.Marker`, using the
 * provided element as the marker's DOM node so the accessible role label and
 * shape cue (from createMarkerElement) are what the map renders.
 */
export const mapboxMarkerFactory: MarkerFactory = (element) =>
  new mapboxgl.Marker({ element }) as unknown as MarkerLike;
