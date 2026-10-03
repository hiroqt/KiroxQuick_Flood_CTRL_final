// src/layers/cityFloodSummaryPopup.ts
//
// Click/tap popup WIRING for the per-city, MODELED flood-susceptibility SUMMARY
// fill. Connects a Mapbox GL JS map click on the city-summary fill layer to the
// presentational <FloodPopup> (susceptibility variant), so clicking a city
// shows: Area (city name), Data type (Susceptibility), Susceptibility level
// (High/Moderate/Low), Source, Dataset date, and the historical-exposure
// disclaimer ("indicates modeled/historical exposure and does not confirm
// current flooding").
//
// This module contains ONLY the mapping + event wiring; it does NO React
// rendering itself — the app/MapView passes a `renderPopup` callback that mounts
// the <FloodPopup>. Everything accepts MINIMAL, structural map/feature
// interfaces so a FAKE map can be injected in tests (no real WebGL map).

import type { SusceptibilityLevel } from '../types/flood';
import type { FloodPopupProps } from '../components/overlays/FloodPopup';
import { CITY_SUMMARY_FILL_LAYER_ID } from './cityFloodSummaryLayer';

/**
 * The subset of a Mapbox GL JS feature this module reads: its `properties` bag
 * (carrying `level`, `name`/`cityName`, `source`, `updatedAt`) and its optional
 * top-level `id`. Kept structural so tests can pass a plain object.
 */
export interface CitySummaryFeatureLike {
  id?: string | number;
  properties?: Record<string, unknown> | null;
}

/** A `{ lng, lat }` position, matching mapboxgl.LngLat's shape. */
export interface LngLatLike {
  lng: number;
  lat: number;
}

/** Fallback shown in the popup's "Area" field when no city name/id is present. */
export const CITY_SUMMARY_AREA_FALLBACK = 'NCR city';

/** SusceptibilityLevel values accepted off feature properties. */
const VALID_LEVELS: readonly SusceptibilityLevel[] = ['HIGH', 'MODERATE', 'LOW'];

function isSusceptibilityLevel(value: unknown): value is SusceptibilityLevel {
  return (
    typeof value === 'string' &&
    (VALID_LEVELS as readonly string[]).includes(value)
  );
}

/**
 * Derives the popup "Area" label from a feature. Prefers `cityName`, then
 * `name`, then the feature `id`, and finally a stable fallback so the field is
 * never blank.
 */
function deriveArea(feature: CitySummaryFeatureLike): string {
  const props = feature.properties ?? {};

  const cityName = props.cityName;
  if (typeof cityName === 'string' && cityName.trim() !== '') {
    return cityName;
  }

  const name = props.name;
  if (typeof name === 'string' && name.trim() !== '') {
    return name;
  }

  const topId = feature.id;
  if (typeof topId === 'string' && topId.trim() !== '') {
    return topId;
  }
  if (typeof topId === 'number' && Number.isFinite(topId)) {
    return String(topId);
  }

  return CITY_SUMMARY_AREA_FALLBACK;
}

/**
 * Maps a clicked city-summary feature's properties to {@link FloodPopupProps}.
 *
 * Always sets `dataType: 'SUSCEPTIBILITY'` so the popup renders the
 * historical-exposure Disclaimer and the Susceptibility level row (never a
 * Flood_State or any "safe"/score language). `area` is the city name (with a
 * fallback); `level` is read only when it is a valid SusceptibilityLevel;
 * `updatedAt` falls back to 0 (rendered "Unknown") when absent/non-numeric, and
 * `source` falls back to an empty string.
 *
 * @param feature - The clicked city-summary feature (structural shape).
 */
export function citySummaryFeatureToPopupProps(
  feature: CitySummaryFeatureLike,
): FloodPopupProps {
  const props = feature.properties ?? {};

  const level = isSusceptibilityLevel(props.level) ? props.level : undefined;
  const source = typeof props.source === 'string' ? props.source : '';
  const updatedAt =
    typeof props.updatedAt === 'number' && Number.isFinite(props.updatedAt)
      ? props.updatedAt
      : 0;

  return {
    area: deriveArea(feature),
    dataType: 'SUSCEPTIBILITY',
    level,
    source,
    updatedAt,
  };
}

/**
 * A Mapbox GL JS-style click/tap event on a layer: carries the queried
 * `features` and the `lngLat` of the click. Kept structural for testability.
 */
export interface CitySummaryLayerClickEvent {
  features?: CitySummaryFeatureLike[];
  lngLat: LngLatLike;
}

/** The map events this module listens to. */
export type CitySummaryMapEvent = 'click' | 'mouseenter' | 'mouseleave';

/**
 * The minimal Mapbox GL JS map surface needed to wire the popup: layer-scoped
 * `on`/`off` and an optional cursor setter (via `getCanvas().style`). Kept
 * structural so a FAKE map can be injected in tests.
 */
export interface CitySummaryPopupMap {
  on(
    event: CitySummaryMapEvent,
    layerId: string,
    handler: (event: CitySummaryLayerClickEvent) => void,
  ): void;
  off(
    event: CitySummaryMapEvent,
    layerId: string,
    handler: (event: CitySummaryLayerClickEvent) => void,
  ): void;
  /** Optional: used to toggle the pointer cursor over city-summary areas. */
  getCanvas?: () => { style: { cursor: string } };
}

/**
 * The callback the app/MapView provides to actually SHOW the popup. It receives
 * the mapped {@link FloodPopupProps} and the click {@link LngLatLike}.
 */
export type RenderCitySummaryPopup = (
  props: FloodPopupProps,
  lngLat: LngLatLike,
) => void;

/** A teardown function returned by {@link installCityFloodSummaryPopup}. */
export type UninstallCitySummaryPopup = () => void;

/**
 * Wires the city-summary click/tap popup onto a map.
 *
 * Registers a `click` handler on {@link CITY_SUMMARY_FILL_LAYER_ID}: when a city
 * feature is clicked, it builds the popup props via
 * {@link citySummaryFeatureToPopupProps} and invokes `renderPopup(props,
 * lngLat)`. It also sets the cursor to `pointer` on `mouseenter` and clears it
 * on `mouseleave` (best-effort; skipped if the map exposes no canvas).
 *
 * @param map - Minimal structural map surface (real map or a test fake).
 * @param renderPopup - Callback that actually displays the popup.
 * @returns A function that removes every handler this installed.
 */
export function installCityFloodSummaryPopup(
  map: CitySummaryPopupMap,
  renderPopup: RenderCitySummaryPopup,
): UninstallCitySummaryPopup {
  const onClick = (event: CitySummaryLayerClickEvent): void => {
    const feature = event.features?.[0];
    if (!feature) {
      return;
    }
    const props = citySummaryFeatureToPopupProps(feature);
    renderPopup(props, event.lngLat);
  };

  const setCursor = (cursor: string): void => {
    const canvas = map.getCanvas?.();
    if (canvas) {
      canvas.style.cursor = cursor;
    }
  };

  const onMouseEnter = (): void => setCursor('pointer');
  const onMouseLeave = (): void => setCursor('');

  map.on('click', CITY_SUMMARY_FILL_LAYER_ID, onClick);
  map.on('mouseenter', CITY_SUMMARY_FILL_LAYER_ID, onMouseEnter);
  map.on('mouseleave', CITY_SUMMARY_FILL_LAYER_ID, onMouseLeave);

  return () => {
    map.off('click', CITY_SUMMARY_FILL_LAYER_ID, onClick);
    map.off('mouseenter', CITY_SUMMARY_FILL_LAYER_ID, onMouseEnter);
    map.off('mouseleave', CITY_SUMMARY_FILL_LAYER_ID, onMouseLeave);
  };
}
